export const simfragFBO = /* glsl */`
uniform sampler2D uPositions;
uniform float time;

varying vec2 vUv;

void main() {

  vec4 pos = texture2D(uPositions, vUv);
  pos.xy += time;
  gl_FragColor = pos;
}
`;