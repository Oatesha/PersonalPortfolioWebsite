// dave hoskins' hashes. a sine hash builds a pair from one dot product, so
// sampling a square with it lands every particle on a curve
const glslRandom = /* glsl */`

  float random(vec2 st) {
    vec3 p = fract(vec3(st.xyx) * 0.1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
  }

  vec2 random2(vec2 st) {
    vec3 p = fract(vec3(st.xyx) * vec3(0.1031, 0.1030, 0.0973));
    p += dot(p, p.yzx + 33.33);
    return fract((p.xx + p.yz) * p.zy);
  }
`;

// every sim pass is one quad over its state texture
export const simVert = /* glsl */`

  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

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

  // forward euler overshoots badly far from the attractor
  const float MAX_STEP = 0.35;

  // above the largest real excursion, dadras at about 7.7
  const float CONTAIN_RADIUS = WORLD_RADIUS * 2.2;
  const float CONTAIN_PULL = 0.03;

  const float BURST_SPEED = 0.022;

  // half angle of the cursor cone, so the dent holds its size on screen
  const float CURSOR_ANGLE = 0.146;

  // a still target keeps the hole, so it is pushed less than it is pulled back by
  const float FIELD_PUSH = 0.25;
  const float TARGET_PUSH = 0.08;

  const float PI = 3.14159265;

  // the step every attractor takes on average once normalised
  const float NOMINAL_STEP = 0.0035 * WORLD_RADIUS;

  // measured by integrating each system offline, normalising all five to one
  // centre, radius and step
  vec3 attractorCentre(int which) {
    if (which == LORENZ) return vec3(0.0, 0.0, 23.52);
    if (which == ROSSLER) return vec3(0.18, -0.89, 0.89);
    if (which == HALVORSEN) return vec3(-2.31, -2.31, -2.31);
    if (which == DADRAS) return vec3(0.94, -0.16, 0.33);
    return vec3(0.33, 0.33, 0.33);
  }

  // 99th percentile distance from the centre
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

  // one step in the normalised space positions are stored in, evaluated in the
  // attractor's own coordinates
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

  // capped, so a particle arrives on its point
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

    // the cursor is the camera ray through the pointer
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
      // swapped outright at the halfway point, where the burst peaks and there
      // is no coherent shape left
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

    // alpha carries speed
    gl_FragColor = vec4(pos, length(velocity) / NOMINAL_STEP);
  }
`;

export const cloudPointVert = /* glsl */`

  uniform sampler2D posTex;
  uniform sampler2D targetTexA;
  uniform sampler2D targetTexB;
  uniform float targetMix;
  uniform float pointSize;
  // 1 where a slot's colours want grading to the page, 0 where they were picked
  uniform float gradeA;
  uniform float gradeB;

  varying vec3 vBaseColour;
  varying float vSpeed;
  varying float vGrade;

  vec3 unpackColour(float packed) {
    int rgb = int(packed);
    return vec3(
      float((rgb >> 16) & 0xFF),
      float((rgb >>  8) & 0xFF),
      float( rgb        & 0xFF)
    ) / 255.0;
  }

  void main() {
    // position holds the sim texel this particle owns
    vec4 state = texture2D(posTex, position.xy);

    vBaseColour = mix(
      unpackColour(texture2D(targetTexA, position.xy).a),
      unpackColour(texture2D(targetTexB, position.xy).a),
      targetMix
    );
    vGrade = mix(gradeA, gradeB, targetMix);
    vSpeed = state.a;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(state.xyz, 1.0);
    gl_PointSize = pointSize;
  }

`;

export const cloudPointFrag = /* glsl */`

// 0 paints the target's own colours, 1 paints particle speed
uniform float colourMix;
uniform vec3 rampLow;
uniform vec3 rampMid;
uniform vec3 rampHigh;
uniform vec3 baseGain;
uniform float baseDesaturate;
uniform vec3 baseTint;
varying vec3 vBaseColour;
varying float vSpeed;
varying float vGrade;

// most particles sit near 1.0, so the interesting range is about 0 to 3
vec3 speedColour(float speed) {
    float t = clamp(speed / 2.6, 0.0, 1.0);
    t = pow(t, 0.65);

    return t < 0.5 ? mix(rampLow, rampMid, t * 2.0) : mix(rampMid, rampHigh, (t - 0.5) * 2.0);
}

void main() {
    float luma = dot(vBaseColour, vec3(0.2126, 0.7152, 0.0722));
    vec3 graded = mix(vBaseColour, vec3(luma) * baseTint, baseDesaturate) * baseGain;
    vec3 base = mix(vBaseColour, graded, vGrade);

    gl_FragColor = vec4(mix(base, speedColour(vSpeed), colourMix), 1.0);
}
`;

// each particle takes its own cell of a grid over the mark
export const markSampleFrag = /* glsl */`

  ${glslRandom}

  uniform sampler2D mask;
  uniform vec2 maskMin;
  uniform vec2 maskMax;
  // one uv known to be opaque, where particles that miss every tap land
  uniform vec2 fallback;
  uniform vec2 extent;
  uniform float depth;
  uniform vec3 tint;
  uniform vec2 lattice;
  uniform float simSide;

  varying vec2 vUv;

  // the pass runs once per build, never per frame
  const int MAX_TAPS = 256;

  // matches samplePositions on the cpu
  float packColour(vec3 colour) {
    vec3 quantised = floor(clamp(colour, 0.0, 1.0) * 255.0 + 0.5);
    return quantised.r * 65536.0 + quantised.g * 256.0 + quantised.b;
  }

  void main() {
    vec2 hit = fallback;
    vec3 rgb = vec3(1.0);

    // random points clump, and over a picture that reads as fuzz. a cell each
    vec2 cell = floor(vUv * simSide);
    float index = cell.x + cell.y * simSide;
    float column = mod(index, lattice.x);
    float row = floor(index / lattice.x);

    bool landed = false;

    if (row < lattice.y) {
      vec2 uv = mix(maskMin, maskMax, (vec2(column, row) + 0.5) / lattice);
      vec4 texel = texture2D(mask, uv);

      if (texel.a > 0.5) {
        hit = uv;
        rgb = texel.rgb;
        landed = true;
      }
    }

    // art with holes, and the few particles with no cell, fall back to rejection
    for (int i = 0; i < MAX_TAPS; i++) {
      if (landed) {
        break;
      }

      float seed = float(i);
      vec2 candidate = random2(vUv + vec2(seed * 7.13, seed * 5.29 + 41.0));

      vec2 uv = mix(maskMin, maskMax, candidate);
      vec4 texel = texture2D(mask, uv);

      if (texel.a > 0.5) {
        hit = uv;
        rgb = texel.rgb;
        break;
      }
    }

    // uv within the opaque box then out to the world box, flipping y
    vec2 local = (hit - maskMin) / max(maskMax - maskMin, vec2(1e-5));
    vec2 centred = local * 2.0 - 1.0;

    float z = (random(vUv + vec2(97.3, 13.1)) * 2.0 - 1.0) * depth;

    gl_FragColor = vec4(
      centred.x * extent.x,
      -centred.y * extent.y,
      z,
      packColour(rgb * tint)
    );
  }
`;
