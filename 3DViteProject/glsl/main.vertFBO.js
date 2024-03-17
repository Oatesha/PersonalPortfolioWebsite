export const vertexShader = /* glsl */`


  uniform sampler2D posTex; // contains positional data read from sim-fs
  uniform float u_time;
  // uniform vec2 mouse;

  void main() {

    // read this particle's position, which is stored as a pixel color
    vec3 pos = texture2D(posTex, position.xy).xyz;

    // vec3 mousePos3D = vec3(mouse.xy, 0.0);
    // float ellipsoidRadiusXY = 5.0;
    // float ellipsoidRadiusZ = 10.0; 
    
    // // Calculate the distance from the particle position to the ellipsoid center
    // vec3 distVec = pos - mousePos3D;
    // float distToEllipsoid = length(vec3(distVec.x / ellipsoidRadiusXY, distVec.y / ellipsoidRadiusXY, distVec.z / ellipsoidRadiusZ));
    
    // if (distToEllipsoid < 1.0) {
      
    //   vec3 dirToEllipsoid = normalize(distVec / vec3(ellipsoidRadiusXY, ellipsoidRadiusXY, ellipsoidRadiusZ));
    //   pos += dirToEllipsoid * 0.3 * smoothstep(1.0, 0.0, distToEllipsoid);
    // }

    // project this particle
    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    gl_PointSize = 0.05;
    // Size attenuation;
    gl_PointSize *= step(1.0 - (1.0/64.0), position.x) + 0.5;

    // float t = u_time * 1.;
    // mvPosition.y -= t;
    // float sinVal = sin(mod(mvPosition.y * 3., 6.28)) * 0.5 + 0.5;
    // float sizeChange = 1. + sinVal * 3.;
    // gl_PointSize = 0.5 * sizeChange;
  }


`;


