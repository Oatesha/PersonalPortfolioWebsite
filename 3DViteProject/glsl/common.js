// one hash everywhere so a particle gets the same jitter from the layout as
// from the simulation. Dave Hoskins' hashes, not the sine one: sine builds its
// result from a single dot product, so a pair of calls at one point move
// together and sampling a square with them lands every particle on a curve
export const glslRandom = /* glsl */`

  float random(vec2 st) {
    vec3 p = fract(vec3(st.xyx) * 0.1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
  }

  // for anything picking a point rather than a number
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
