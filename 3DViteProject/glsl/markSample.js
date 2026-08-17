import { glslRandom } from './common.js';

// run once when a mark is picked. each particle takes its own cell of a grid
// over the mark, and the hit is the point state 0 marches it to
export const markSampleFrag = /* glsl */`

  ${glslRandom}

  uniform sampler2D mask;
  // the opaque bounding box of the mask in uv, so svg padding costs no taps
  uniform vec2 maskMin;
  uniform vec2 maskMax;
  // one uv known to be opaque, where particles that miss every tap land
  uniform vec2 fallback;
  uniform vec2 extent;
  uniform float depth;
  uniform vec3 tint;
  // the grid over the mark, and the side of the sim texture the particle index
  // is recovered from
  uniform vec2 lattice;
  uniform float simSide;

  varying vec2 vUv;

  // the pass runs once per build, never per frame, so taps are cheap
  const int MAX_TAPS = 256;

  // matches samplePositions on the cpu. unpacked again in cloudPoint
  float packColour(vec3 colour) {
    vec3 quantised = floor(clamp(colour, 0.0, 1.0) * 255.0 + 0.5);
    return quantised.r * 65536.0 + quantised.g * 256.0 + quantised.b;
  }

  void main() {
    vec2 hit = fallback;
    vec3 rgb = vec3(1.0);

    // random points clump, and over a picture that reads as fuzz however many
    // particles are thrown at it. a cell each instead
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

    // art with holes in it, and the few particles with no cell, fall back to
    // rejection sampling. breaks on the first opaque tap
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

    // uv within the opaque box then out to the world box. the mask's y runs down
    // the image and the world's runs up
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
