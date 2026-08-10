import { glslRandom } from './random.js';

// one fragment per particle run once when a mark is picked. each particle
// rejection samples the mark's alpha and the hit is the point state 0 marches
// it to

export const markSampleFrag = /* glsl */`

  ${glslRandom}

  uniform sampler2D mask;
  // the opaque bounding box of the mask in uv so svg padding costs no taps
  uniform vec2 maskMin;
  uniform vec2 maskMax;
  // one uv known to be opaque where particles that miss every tap land
  uniform vec2 fallback;
  // world half extents the mask is fitted to and half the plate's thickness
  uniform vec2 extent;
  uniform float depth;
  // multiplied into the mask's own colour so a white silhouette comes out in
  // the job's accent
  uniform vec3 tint;

  varying vec2 vUv;

  // at 64 taps a mark covering 15% of its bounding box leaves about three
  // particles in a million on the fallback
  const int MAX_TAPS = 64;

  // matches samplePositions on the cpu. three 8 bit channels in one float
  // unpacked again in main.vertFBO
  float packColour(vec3 colour) {
    vec3 quantised = floor(clamp(colour, 0.0, 1.0) * 255.0 + 0.5);
    return quantised.r * 65536.0 + quantised.g * 256.0 + quantised.b;
  }

  void main() {
    vec2 hit = fallback;
    vec3 rgb = vec3(1.0);

    // breaks on the first opaque tap so average cost is one over the coverage
    for (int i = 0; i < MAX_TAPS; i++) {
      float seed = float(i);
      vec2 candidate = vec2(
        random(vUv + vec2(seed * 7.13, 11.7)),
        random(vUv + vec2(3.71, seed * 5.29 + 41.0))
      );

      vec2 uv = mix(maskMin, maskMax, candidate);
      vec4 texel = texture2D(mask, uv);

      if (texel.a > 0.5) {
        hit = uv;
        rgb = texel.rgb;
        break;
      }
    }

    // uv within the opaque box then out to the world box. the mask's y runs
    // down the image and the world's runs up
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
