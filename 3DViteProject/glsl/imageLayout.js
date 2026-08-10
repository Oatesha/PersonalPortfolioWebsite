import { glslRandom } from './random.js';

// where each of the screenshot's particles belongs and how much of the image it
// carries. interpolated into both the sim and the point shader which have to
// agree exactly or the image draws out of register with itself
export const imageLayout = /* glsl */`

  ${glslRandom}

  // side of the square state texture. one texel per particle
  uniform float gridSize;
  // columns and rows of the grid those particles are actually laid out on. the
  // state texture has to be square because it is a ping ponged render target
  // but a screenshot is not. a square grid over a wide image lands particles
  // further apart across than down so the texel is unpacked into a virtual grid
  // whose shape matches the image's own aspect
  uniform vec2 gridDims;

  // how much of the grid is pulled towards the middle of the image. 0 is an
  // even spread. horizontal only because across is where a screenshot has room
  // to spare
  const float FOVEA = 0.35;

  // half a cell of stagger on alternate rows. hexagonal packing so no two
  // particles in adjacent rows share a column
  const float JITTER = 0.15;

  // a texel unpacked into its place on the virtual grid in 0..1 grid space. z
  // is 0 for texels the grid does not reach because columns times rows rarely
  // divides the texture exactly
  vec3 virtualCell(vec2 texel) {
    float index = floor(texel.x * gridSize) + floor(texel.y * gridSize) * gridSize;
    float row = floor(index / gridDims.x);
    float column = index - row * gridDims.x;

    if (row > gridDims.y - 1.0) {
      return vec3(0.0, 0.0, 0.0);
    }

    float stagger = mod(row, 2.0) * 0.5;
    vec2 jitter = (vec2(random(texel * 1.7), random(texel * 2.3 + 5.1)) - 0.5) * JITTER;
    vec2 cell = (vec2(column + 0.5 + stagger, row + 0.5) + jitter) / gridDims;

    return vec3(clamp(cell, 0.0, 1.0), 1.0);
  }

  // grid space across to image space across. odd powers only so it stays
  // symmetric about the middle and monotonic
  float foveate(float across) {
    float t = across * 2.0 - 1.0;

    return (t * (1.0 - FOVEA) + t * t * t * FOVEA) * 0.5 + 0.5;
  }

  // the slope of that warp as a multiple of the even spacing. vertical is
  // untouched so always 1
  vec2 foveateSpread(float across) {
    float t = across * 2.0 - 1.0;

    return vec2((1.0 - FOVEA) + 3.0 * FOVEA * t * t, 1.0);
  }

  // the point of the screenshot a grid cell stands for
  vec2 imagePoint(vec2 cell) {
    return vec2(foveate(cell.x), cell.y);
  }
`;
