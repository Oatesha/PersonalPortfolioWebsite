export const vertexShader = /* glsl */`

 precision mediump float;

  uniform sampler2D posTex; // contains positional data read from sim-fs
  uniform mat4 projectionMatrix;
  uniform mat4 modelViewMatrix;

  attribute vec2 position;

  void main() {

    // read this particle's position, which is stored as a pixel color
    vec3 pos = texture2D(posTex, position.xy).xyz;

    // project this particle
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // set the size of each particle
    gl_PointSize = 0.3 / -mvPosition.z;
  }



`;


