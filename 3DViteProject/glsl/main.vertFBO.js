export const vertexShader = /* glsl */`

  uniform sampler2D posTex;
  // the ship's sampled vertex colours, kept here rather than copied through the
  // sim each frame so the sim's alpha channel is free to carry speed
  uniform sampler2D shipPosTex;
  uniform float pointSize;

  varying float vShipColour;
  varying float vSpeed;

  void main() {
    // position holds the sim texel this particle owns, not a place in the world
    vec4 state = texture2D(posTex, position.xy);

    vShipColour = texture2D(shipPosTex, position.xy).a;
    vSpeed = state.a;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(state.xyz, 1.0);
    gl_PointSize = pointSize;
  }

`;
