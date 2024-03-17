export const vertexShader = /* glsl */`


  uniform sampler2D posTex; // contains positional data read from sim-fs
  uniform float u_time;
  varying vec2 vUv;
  // uniform vec2 mouse;

  void main() {
    vUv = uv;
    // read this particle's position, which is stored as a pixel color
    vec3 pos = texture2D(posTex, position.xy).xyz;




    // project this particle
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    gl_PointSize = 0.5;
    // // Size attenuation;
    // gl_PointSize *= step(1.0 - (1.0/64.0), position.x) + 0.5;

    // float t = u_time * 1.;
    // mvPosition.y -= t;
    // float sinVal = sin(mod(mvPosition.y * 3., 6.28)) * 0.5 + 0.5;
    // float sizeChange = 1. + sinVal * 3.;
    // gl_PointSize = 0.5 * sizeChange;
  }


`;


