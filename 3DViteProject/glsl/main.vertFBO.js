export const vertexShader = /* glsl */`


  uniform sampler2D posTex; // contains positional data read from sim-fs
  uniform float time;

  void main() {

    // read this particle's position, which is stored as a pixel color
    vec3 pos = texture2D(posTex, position.xy).xyz;


    // project this particle
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    gl_PointSize = 2.5;
    // Size attenuation;
    gl_PointSize *= step(1.0 - (1.0/64.0), position.x) + 0.5;
  }



`;


