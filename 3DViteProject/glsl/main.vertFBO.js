export const vertexShader = /* glsl */`


  uniform sampler2D posTex;
  uniform float u_time;
  uniform float pointSize;
  varying vec2 vUv;
  varying float vColour;
  // uniform vec2 mouse;

  void main() {
    vUv = uv;
    // read this particle's position, which is stored as a pixel color
    vec3 pos = texture2D(posTex, position.xy).xyz;

    vColour = texture2D(posTex, position.xy).w; 

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    gl_PointSize = pointSize;

    // Size attenuation;
    gl_PointSize *= step(1.0 - (1.0/64.0), position.z) + 0.5;
  }


`;


