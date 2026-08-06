export const vertexShader = /* glsl */`


  uniform sampler2D posTex;
  // the ship's sampled vertex colours, kept here rather than copied through the
  // sim each frame so the sim's alpha channel is free to carry speed
  uniform sampler2D shipPosTex;
  uniform float u_time;
  uniform float pointSize;
  varying vec2 vUv;
  varying float vShipColour;
  varying float vSpeed;
  // uniform vec2 mouse;

  void main() {
    vUv = uv;
    // read this particle's position, which is stored as a pixel color
    vec3 pos = texture2D(posTex, position.xy).xyz;

    vShipColour = texture2D(shipPosTex, position.xy).a;
    vSpeed = texture2D(posTex, position.xy).a;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    gl_PointSize = pointSize;

    // Size attenuation;
    // gl_PointSize *= step(1.0 - (1.0/64.0), position.z) + 0.5;
  }


`;


