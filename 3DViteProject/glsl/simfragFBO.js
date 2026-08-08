import { glslRandom } from './random.js';

export const simfragFBO = /* glsl */`

  ${glslRandom}

  uniform sampler2D posTex;
  uniform sampler2D shipPosTex;
  // the cursor as the camera ray through the pointer, origin and unit direction
  // in world space. a particle is under the cursor when it is close to the ray,
  // so test perpendicular distance and push perpendicular too
  uniform vec3 mouseOrigin;
  uniform vec3 mouseDir;
  // distance from the camera to the centre of the cloud, where the cursor's
  // radius is quoted before being scaled along the ray
  uniform float mouseDepth;
  // zero until the pointer has moved, ndc (0, 0) is the middle of the cloud
  uniform float mouseActive;
  uniform int state;
  uniform float maxDist;
  uniform float time;
  // how many 60Hz frames of sim to advance this frame. the integrators below
  // use fixed timesteps
  uniform float dtScale;
  // which attractor the cloud is leaving and arriving at, and how far through.
  // idle sits at morph 1.0
  uniform int attractorFrom;
  uniform int attractorTo;
  uniform float morph;
  // radius of whatever the cloud currently is, so the mouse repulsion can be a
  // fraction of it rather than absolute world units
  uniform float cloudRadius;

  varying vec2 vUv;

  const int THOMAS = 0;
  const int LORENZ = 1;
  const int ROSSLER = 2;
  const int HALVORSEN = 3;
  const int DADRAS = 4;

  // every attractor is normalised into a sphere of this radius about the
  // origin. each was integrated offline and its centre, radius and timestep
  // measured
  const float WORLD_RADIUS = 4.0;

  // forward euler on these fields overshoots badly far from the attractor, and
  // particles arrive from the ship at several times its scale
  const float MAX_STEP = 0.35;

  // nothing in these fields brings back a particle that lands well outside.
  // set above the largest real excursion of the five, dadras reaches about 7.7
  const float CONTAIN_RADIUS = WORLD_RADIUS * 2.2;
  const float CONTAIN_PULL = 0.03;

  // peak outward speed at the midpoint of a switch, tuned so the cloud roughly
  // doubles in radius and no more
  const float BURST_SPEED = 0.022;

  const float PI = 3.14159265;

  // the step every attractor takes on average once normalised, by construction
  // of attractorDt. speed is divided through by it before being written out
  const float NOMINAL_STEP = 0.0035 * WORLD_RADIUS;

  // particles arrive from well outside, so an attractor is only usable if one
  // dropped out there still finds the chaotic set. aizawa and arneodo do not.
  // check any new one at 2x and 3x its radius

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

  // picked per attractor so after normalisation they all move a particle the
  // same distance per frame
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

  // one step of the given attractor in the normalised space positions are
  // stored in. the field itself is evaluated in the attractor's own coordinates
  vec3 attractorStep(int which, vec3 pos) {
    float k = attractorRadius(which) / WORLD_RADIUS;
    vec3 native = attractorCentre(which) + pos * k;
    vec3 delta = attractorDerivative(which, native) * (attractorDt(which) / k);

    float len = length(delta);
    return len > MAX_STEP ? delta * (MAX_STEP / len) : delta;
  }

vec3 mod289(vec3 x) {
    return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec2 mod289(vec2 x) {
    return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec3 permute(vec3 x) {
    return mod289(((x * 34.0) + 1.0) * x);
}

float noise(vec2 v) {
    const vec4 C = vec4(0.211324865405187,  // (3.0-sqrt(3.0))/6.0
    0.366025403784439,  // 0.5*(sqrt(3.0)-1.0)
    -0.577350269189626,  // -1.0 + 2.0 * C.x
    0.024390243902439); // 1.0 / 41.0
    // First corner
    vec2 i = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);

    // Other corners
    vec2 i1;
    //i1.x = step( x0.y, x0.x ); // x0.x > x0.y ? 1.0 : 0.0
    //i1.y = 1.0 - i1.x;
    i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    // x0 = x0 - 0.0 + 0.0 * C.xx ;
    // x1 = x0 - i1 + 1.0 * C.xx ;
    // x2 = x0 - 1.0 + 2.0 * C.xx ;
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;

    // Permutations
    i = mod289(i); // Avoid truncation effects in permutation
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));

    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
    m = m * m;
    m = m * m;

    // Gradients: 41 points uniformly over a line, mapped onto a diamond.
    // The ring size 17*17 = 289 is close to a multiple of 41 (41*7 = 287)

    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;

    // Normalise gradients implicitly by scaling m
    // Approximation of: m *= inversesqrt( a0*a0 + h*h );
    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);

    // Compute final noise value at P
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
}

vec3 curl(float x, float y, float z) {

    float eps = 1., eps2 = 2. * eps;
    float n1, n2, a, b;

    x += time * .05;
    y += time * .05;
    z += time * .05;

    vec3 curl = vec3(0.);

    n1 = noise(vec2(x, y + eps));
    n2 = noise(vec2(x, y - eps));
    a = (n1 - n2) / eps2;

    n1 = noise(vec2(x, z + eps));
    n2 = noise(vec2(x, z - eps));
    b = (n1 - n2) / eps2;

    curl.x = a - b;

    n1 = noise(vec2(y, z + eps));
    n2 = noise(vec2(y, z - eps));
    a = (n1 - n2) / eps2;

    n1 = noise(vec2(x + eps, z));
    n2 = noise(vec2(x + eps, z));
    b = (n1 - n2) / eps2;

    curl.y = a - b;

    n1 = noise(vec2(x + eps, y));
    n2 = noise(vec2(x - eps, y));
    a = (n1 - n2) / eps2;

    n1 = noise(vec2(y + eps, z));
    n2 = noise(vec2(y - eps, z));
    b = (n1 - n2) / eps2;

    curl.z = a - b;

    return curl;
}

// direction a particle flies in during a switch, mostly its own fixed random
// one, biased outwards so it clears the middle
vec3 scatterDirection(vec3 pos, vec2 uv) {
    vec3 jitter = vec3(random(uv), random(uv + 11.3), random(uv + 27.7)) * 2.0 - 1.0;
    vec3 outward = pos / max(length(pos), 0.001);
    return normalize(jitter + outward * 0.6);
}

vec3 forceToOriginalPos(vec3 currentPos, vec3 originalPos) {

    vec3 direction = normalize(originalPos - currentPos);
    float distance = length(originalPos - currentPos);

    if (distance < 0.05) {
      return vec3(0.0);
    } 

    return (direction);
}

  float frequency = 0.35;
  float amplitude = 0.09;
  float mixVal = 0.0;

  void main() {

    float maxDistance = maxDist;
    // Read the supplied x, y, z vert positions
    vec3 pos = texture2D(posTex, vUv).xyz;
    // displacement this frame, its length is written out as speed
    vec3 velocity = vec3(0.0);

    
    // Read the original position without mouse
    vec3 originalShipPos = texture2D(shipPosTex, vUv).xyz;
    
    // sized against whatever the cloud currently is, not absolute units
    float cursorRadius = cloudRadius * 0.20;
    float repelStrength = cloudRadius * 0.05;

    // where the particle sits relative to the ray, how far along and how far off
    vec3 fromCamera = pos - mouseOrigin;
    float alongRay = dot(fromCamera, mouseDir);

    // behind the camera there is no cursor
    if (mouseActive > 0.5 && alongRay > 0.0) {
      vec3 offRay = fromCamera - mouseDir * alongRay;
      float distToRay = length(offRay);
      // widen with distance so the cursor is a cone of constant screen size
      float radius = cursorRadius * (alongRay / mouseDepth);

      if (distToRay < radius) {
        // dead on the ray there is no perpendicular to push along
        vec3 push = distToRay > 1e-4
          ? offRay / distToRay
          : normalize(cross(mouseDir, vec3(random(vUv), random(vUv + 5.1), random(vUv + 9.3)) * 2.0 - 1.0));
        pos += push * repelStrength * smoothstep(1.0, 0.0, distToRay / radius);
      }
    }


    if (state == 1) {
      // the field is swapped outright at the halfway point rather than the two
      // being blended. the burst peaks there, so there is no coherent shape
      // left for the swap to be discontinuous in
      int running = morph < 0.5 ? attractorFrom : attractorTo;
      velocity = attractorStep(running, pos);

      // zero at both ends, so the cloud leaves one attractor and settles into
      // the next under nothing but the attractor's own pull
      float burst = sin(morph * PI);
      velocity += scatterDirection(pos, vUv) * (burst * BURST_SPEED);

      pos += velocity * dtScale;

      // gathers strays, and doubles as what walks the scattered ship down to
      // attractor scale
      float dist = length(pos);
      if (dist > CONTAIN_RADIUS) {
        pos = mix(pos, pos * (CONTAIN_RADIUS / dist), min(CONTAIN_PULL * dtScale, 1.0));
      }
    }
    
    else {
    // float cycleTime = mod(time, 40.0); // Total cycle duration is 30 seconds

    // if (cycleTime < 10.0) {
    //   mixVal = 0.0;
    // } 
    // else if (cycleTime < 20.0) {
    //   float t = (cycleTime - 10.0) / 10.0;
    //   mixVal = smoothstep(0.0, 1.0, t * 2.0); 
    // } 
    // else if (cycleTime > 20.0 && cycleTime < 30.0) {
    //   mixVal = 1.0;
    // } 
    // else {
    //   float t = (cycleTime - 30.0) / 10.0;
    //   mixVal = smoothstep(1.0, 0.0, t * 2.0); 
    // }

      velocity = forceToOriginalPos(pos, originalShipPos) * 0.05;
      pos += velocity * dtScale;
    }

    // alpha carries speed rather than colour, so the attractors are shaded by
    // how hard the field is whipping a particle around
    gl_FragColor = vec4(pos, length(velocity) / NOMINAL_STEP);
  }
`;