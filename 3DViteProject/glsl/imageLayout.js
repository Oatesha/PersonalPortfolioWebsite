import { glslRandom } from './common.js';

// shared by the image sim and the image point shader, which have to agree
// exactly or the picture draws out of register with itself
export const imageLayout = /* glsl */`

  ${glslRandom}

  uniform float gridSize;
  // the state texture is square because it is a ping ponged render target, but a
  // screenshot is not. each texel is unpacked onto a virtual grid of these
  // dimensions so spacing across matches spacing down
  uniform vec2 gridDims;

  // how much of the grid is pulled towards the middle of the image. 0 is an even
  // spread. horizontal only because across is where a screenshot has room to spare
  const float FOVEA = 0.35;

  const float JITTER = 0.15;

  // z is 0 for texels the grid does not reach, since columns times rows rarely
  // divides the texture exactly
  vec3 virtualCell(vec2 texel) {
    float index = floor(texel.x * gridSize) + floor(texel.y * gridSize) * gridSize;
    float row = floor(index / gridDims.x);
    float column = index - row * gridDims.x;

    if (row > gridDims.y - 1.0) {
      return vec3(0.0, 0.0, 0.0);
    }

    // half a cell on alternate rows so no two neighbours share a column
    float stagger = mod(row, 2.0) * 0.5;
    vec2 jitter = (vec2(random(texel * 1.7), random(texel * 2.3 + 5.1)) - 0.5) * JITTER;
    vec2 cell = (vec2(column + 0.5 + stagger, row + 0.5) + jitter) / gridDims;

    return vec3(clamp(cell, 0.0, 1.0), 1.0);
  }

  // odd powers only so the warp stays symmetric about the middle and monotonic
  float foveate(float across) {
    float t = across * 2.0 - 1.0;

    return (t * (1.0 - FOVEA) + t * t * t * FOVEA) * 0.5 + 0.5;
  }

  // slope of that warp as a multiple of the even spacing
  vec2 foveateSpread(float across) {
    float t = across * 2.0 - 1.0;

    return vec2((1.0 - FOVEA) + 3.0 * FOVEA * t * t, 1.0);
  }

  vec2 imagePoint(vec2 cell) {
    return vec2(foveate(cell.x), cell.y);
  }
`;
