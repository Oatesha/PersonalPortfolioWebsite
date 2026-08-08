import { imageLayout } from './imageLayout.js';

// draws the project screenshot's particles. position comes from the sim
// texture, colour from the screenshot itself at the point this particle stands
// for
export const imagePointVert = /* glsl */`

  // sampling an explicit mip level, under whichever glsl version three decides
  // to compile this as. it rewrites every ShaderMaterial to "#version 300 es"
  // on a webgl2 context and patches the old names over the new ones, but the
  // LOD form only in the fragment prefix and only under its EXT name, so
  // texture2DLod is undeclared here and the program fails to build
  #if __VERSION__ >= 300
    #define sampleLod(image, uv, lod) textureLod(image, uv, lod)
  #else
    #define sampleLod(image, uv, lod) texture2DLod(image, uv, lod)
  #endif

  ${imageLayout}

  uniform sampler2D posTex;
  // the screenshot being shown and the one before it, crossfaded while the
  // burst has the particles scattered
  uniform sampler2D nextTex;
  uniform sampler2D prevTex;
  uniform float fade;
  // mip level to read each of them at, for a particle of nominal size. there
  // are far more pixels in a screenshot than particles to carry them, so a
  // plain fetch aliases rather than samples
  uniform float nextLod;
  uniform float prevLod;
  // device pixels between neighbouring particles where the grid is evenly
  // spread. one number, the virtual grid is proportioned to the image so the
  // spacing is the same on both axes
  uniform float baseSpacing;
  // how far the three channels are pulled apart per unit of particle speed
  uniform float aberration;

  varying vec3 vColour;

  // points have to reach their neighbours or the image shows through as a
  // screen door. on a staggered grid the furthest a gap can be from the four
  // points around it is a little over half the spacing, and the soft edge below
  // means a point is only opaque well inside its nominal size
  const float POINT_OVERLAP = 1.35;
  const float MIN_POINT_SIZE = 1.0;
  const float MAX_POINT_SIZE = 12.0;

  vec3 sampleImage(sampler2D image, vec2 uv, float shift, float lod) {
    vec4 centre = sampleLod(image, uv, lod);

    // three fetches only for the particles actually moving, this runs a
    // million times a frame
    if (shift < 0.0004) {
      return centre.rgb;
    }

    return vec3(
      sampleLod(image, uv + vec2(shift, 0.0), lod).r,
      centre.g,
      sampleLod(image, uv - vec2(shift, 0.0), lod).b
    );
  }

  void main() {
    // the grid cell this particle reads its state from. not called uv, three
    // declares an attribute of that name into every ShaderMaterial vertex
    // shader and a local that shadows it reads like a bug
    vec3 cell = virtualCell(position.xy);

    // the handful of texels the virtual grid doesn't reach, sent outside the
    // clip volume so they cost a vertex and nothing else
    if (cell.z < 0.5) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      gl_PointSize = 0.0;
      return;
    }

    vec4 state = sampleLod(posTex, position.xy, 0.0);
    vec2 pos = state.xy;
    float speed = length(state.zw);

    // how much of the image this particle is carrying, which both its size and
    // the mip it reads follow from. out at the sides the foveation has spread
    // the grid thin, so each particle stands for more of the screenshot
    vec2 spread = foveateSpread(cell.x);
    float size = baseSpacing * max(spread.x, spread.y) * POINT_OVERLAP;
    float lodOffset = log2(max(spread.x, spread.y));

    // chromatic split proportional to speed, so it falls out of the motion
    // itself rather than having to be driven
    float shift = min(speed * aberration, 0.02);
    // not called uv, same reason
    vec2 source = imagePoint(cell.xy);

    vColour = sampleImage(nextTex, source, shift, nextLod + lodOffset);

    // a uniform branch, so every particle takes the same side of it
    if (fade < 0.999) {
      vColour = mix(sampleImage(prevTex, source, shift, prevLod + lodOffset), vColour, fade);
    }

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 0.0, 1.0);
    gl_PointSize = clamp(size, MIN_POINT_SIZE, MAX_POINT_SIZE);
  }
`;

export const imagePointFrag = /* glsl */`

  varying vec3 vColour;

  void main() {
    // round with a soft edge, square points at this density read as a mosaic.
    // opaque out to most of the radius, then a short ramp
    float d = length(gl_PointCoord - 0.5);
    float alpha = smoothstep(0.5, 0.40, d);

    if (alpha < 0.01) {
      discard;
    }

    gl_FragColor = vec4(vColour, alpha);
  }
`;
