// one hash everywhere so a particle gets the same jitter from the layout as
// from the simulation
export const glslRandom = /* glsl */`

  float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
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
