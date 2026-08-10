// the one hash the shaders use. same constants everywhere so a particle gets
// the same jitter from the layout as from the simulation
export const glslRandom = /* glsl */`

  float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
  }
`;
