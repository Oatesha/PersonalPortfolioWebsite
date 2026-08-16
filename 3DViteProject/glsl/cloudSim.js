import { glslRandom } from './common.js';

export const cloudSimFrag = /* glsl */`

  ${glslRandom}

  uniform sampler2D posTex;
  uniform sampler2D targetTexA;
  uniform sampler2D targetTexB;
  uniform float targetMix;
  uniform vec3 mouseOrigin;
  uniform vec3 mouseDir;
  uniform float mouseActive;
  uniform int state;
  uniform float dtScale;
  uniform int attractorFrom;
  uniform int attractorTo;
  uniform float morph;
  uniform float cloudRadius;

  varying vec2 vUv;

  const int THOMAS = 0;
  const int LORENZ = 1;
  const int ROSSLER = 2;
  const int HALVORSEN = 3;
  const int DADRAS = 4;

  const float WORLD_RADIUS = 4.0;

  // forward euler on these fields overshoots badly far from the attractor and
  // particles arrive from the ship at several times its scale
  const float MAX_STEP = 0.35;

  // nothing in these fields brings back a particle that lands well outside. set
  // above the largest real excursion of the five, dadras at about 7.7
  const float CONTAIN_RADIUS = WORLD_RADIUS * 2.2;
  const float CONTAIN_PULL = 0.03;

  const float BURST_SPEED = 0.022;

  // half angle of the cursor cone, so the dent is the same size on screen
  // whatever distance the cloud is framed at
  const float CURSOR_ANGLE = 0.146;

  // the shove inside the cone, against its radius there. an attractor carries
  // the dent away in a few frames, a still target would keep the hole, so a
  // target has to be pushed less per frame than it is pulled back by
  const float FIELD_PUSH = 0.25;
  const float TARGET_PUSH = 0.08;

  const float PI = 3.14159265;

  // the step every attractor takes on average once normalised. speed is divided
  // through by it before being written out
  const float NOMINAL_STEP = 0.0035 * WORLD_RADIUS;

  // the three tables below were measured by integrating each system offline.
  // they normalise all five to one centre, radius and step so switching moves
  // no camera. particles arrive from well outside, so a new attractor is only
  // usable if one dropped at 2x and 3x its radius still finds the chaotic set.
  // aizawa and arneodo do not
  vec3 attractorCentre(int which) {
    if (which == LORENZ) return vec3(0.0, 0.0, 23.52);
    if (which == ROSSLER) return vec3(0.18, -0.89, 0.89);
    if (which == HALVORSEN) return vec3(-2.31, -2.31, -2.31);
    if (which == DADRAS) return vec3(0.94, -0.16, 0.33);
    return vec3(0.33, 0.33, 0.33);
  }

  // 99th percentile distance from the centre rather than the maximum
  float attractorRadius(int which) {
    if (which == LORENZ) return 27.74;
    if (which == ROSSLER) return 17.23;
    if (which == HALVORSEN) return 12.94;
    if (which == DADRAS) return 12.21;
    return 5.12;
  }

  float attractorDt(int which) {
    if (which == LORENZ) return 0.001007;
    if (which == ROSSLER) return 0.006938;
    if (which == HALVORSEN) return 0.001348;
    if (which == DADRAS) return 0.003503;
    return 0.024890;
  }

  vec3 attractorDerivative(int which, vec3 p) {
    float x = p.x;
    float y = p.y;
    float z = p.z;

    if (which == LORENZ) {
      return vec3(10.0 * (y - x), x * (28.0 - z) - y, x * y - 2.6666667 * z);
    }

    if (which == ROSSLER) {
      return vec3(-y - z, x + 0.2 * y, 0.2 + z * (x - 5.7));
    }

    if (which == HALVORSEN) {
      float a = 1.89;
      return vec3(
        -a * x - 4.0 * y - 4.0 * z - y * y,
        -a * y - 4.0 * z - 4.0 * x - z * z,
        -a * z - 4.0 * x - 4.0 * y - x * x
      );
    }

    if (which == DADRAS) {
      return vec3(y - 3.0 * x + 2.7 * y * z, 1.7 * y - x * z + z, 2.0 * x * y - 9.0 * z);
    }

    float b = 0.19;
    return vec3(-b * x + sin(y), -b * y + sin(z), -b * z + sin(x));
  }

  // one step in the normalised space positions are stored in. the field itself
  // is evaluated in the attractor's own coordinates
  vec3 attractorStep(int which, vec3 pos) {
    float k = attractorRadius(which) / WORLD_RADIUS;
    vec3 native = attractorCentre(which) + pos * k;
    vec3 delta = attractorDerivative(which, native) * (attractorDt(which) / k);

    float len = length(delta);
    return len > MAX_STEP ? delta * (MAX_STEP / len) : delta;
  }

vec3 scatterDirection(vec3 pos, vec2 uv) {
    vec3 jitter = vec3(random2(uv), random(uv + 27.7)) * 2.0 - 1.0;
    vec3 outward = pos / max(length(pos), 0.001);
    return normalize(jitter + outward * 0.6);
}

// capped rather than cut off short of the target, so a particle arrives on its
// point instead of stopping a slop radius away with its edge left soft
vec3 forceToTarget(vec3 currentPos, vec3 targetPos, float reach) {
    vec3 toHome = targetPos - currentPos;
    float away = length(toHome);

    if (away < 1e-5) {
      return vec3(0.0);
    }

    return toHome * (min(reach, away) / away);
}

  void main() {
    vec3 pos = texture2D(posTex, vUv).xyz;
    vec3 velocity = vec3(0.0);

    vec3 targetPos = mix(
      texture2D(targetTexA, vUv).xyz,
      texture2D(targetTexB, vUv).xyz,
      targetMix
    );

    // the cursor is the camera ray through the pointer. split the particle into
    // distance along it and distance off it
    vec3 fromCamera = pos - mouseOrigin;
    float alongRay = dot(fromCamera, mouseDir);

    if (mouseActive > 0.5 && alongRay > 0.0) {
      vec3 offRay = fromCamera - mouseDir * alongRay;
      float distToRay = length(offRay);
      float radius = CURSOR_ANGLE * alongRay;

      if (distToRay < radius) {
        float shove = radius * (state == 1 ? FIELD_PUSH : TARGET_PUSH);
        vec3 push = distToRay > 1e-4
          ? offRay / distToRay
          : normalize(cross(mouseDir, vec3(random2(vUv), random(vUv + 9.3)) * 2.0 - 1.0));
        pos += push * shove * smoothstep(1.0, 0.0, distToRay / radius);
      }
    }


    if (state == 1) {
      // swapped outright at the halfway point where the burst peaks and there
      // is no coherent shape left to be discontinuous in
      int running = morph < 0.5 ? attractorFrom : attractorTo;
      velocity = attractorStep(running, pos);

      // zero at both ends so each attractor is left and entered under its pull
      float burst = sin(morph * PI);
      velocity += scatterDirection(pos, vUv) * (burst * BURST_SPEED);

      pos += velocity * dtScale;

      float dist = length(pos);
      if (dist > CONTAIN_RADIUS) {
        pos = mix(pos, pos * (CONTAIN_RADIUS / dist), min(CONTAIN_PULL * dtScale, 1.0));
      }
    }

    else {
      vec3 step = forceToTarget(pos, targetPos, 0.05 * dtScale);
      pos += step;
      velocity = step / max(dtScale, 1e-3);
    }

    // alpha carries speed, not colour
    gl_FragColor = vec4(pos, length(velocity) / NOMINAL_STEP);
  }
`;
