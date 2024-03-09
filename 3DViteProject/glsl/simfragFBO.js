export const simfragFBO = /* glsl */`

  uniform sampler2D posTex;
  uniform vec2 mouse;
  uniform int state;
  varying vec2 vUv;
  

  vec3 thomasAttractor(vec3 pos) {
    float b = 0.2;
    
    // Timestep 
    float dt = 0.025;
    
    float x = pos.x;
    float y = pos.y;
    float z = pos.z;
    
    float dx, dy, dz;
    
    dx = (-b*x + sin(y)) * dt;
    dy = (-b*y + sin(z)) * dt;
    dz = (-b*z + sin(x)) * dt;
    
    return vec3(dx, dy, dz);
  }

  vec3 lorezAttractor(vec3 pos) {
    // Lorenz Attractor parameters
    float a = 10.0;
    float b = 28.0;
    float c = 2.6666666667;
    
    // Timestep 
    float dt = 0.1;
    
    float x = pos.x;
    float y = pos.y;
    float z = pos.z;
    
    float dx, dy, dz;
    
    dx = dt * (a * (y - x));
    dy = dt * (x * (b - z) - y);
    dz = dt * (x * y - c * z);
    
    return vec3(dx, dy, dz);
  }

  vec3 randomAttractor(vec3 pos) {
  
    float dt = 0.1;

    float x = pos.x;
    float y = pos.y;
    float z = pos.z;
    
    float dx, dy, dz;
    
    float a = -1.7;
    float b = 1.8;
    float c = -0.9;
    float d = -0.4;

    dx= dt * (sin(a*y)+c*cos(a*x));
    dy= dt * (sin(b*x)+d*cos(b*y));
    dz = 0.0;
    
    return vec3(dx, dy, dz);
  }

  vec3 twoDAttractor(vec3 pos) {

    float dt = 0.100;

    float a = 0.65343; 
    float b= 0.7345345;

    float x = pos.x;
    float y = pos.y;
    float z = pos.z;
    
    float dx, dy, dz;

    dx= (sin(x*y/b)*y+cos(a*x-y)) * dt;
    dy= (x+sin(y)/b) * dt;

    return vec3(dx, dy, 0);
  }

  void main() {

    // Read the supplied x, y, z vert positions
    vec3 pos = texture2D(posTex, vUv).xyz;
    vec3 dpos = thomasAttractor(pos);
    pos.x += dpos.x;
    pos.y += dpos.y;
    pos.z += dpos.z;


    vec3 mousePos3D = vec3(mouse.xy, 0.0);
    float ellipsoidRadiusXY = 2.0;
    float ellipsoidRadiusZ = 10.0; 

    // Calculate the distance from the particle position to the ellipsoid center
    vec3 distVec = pos - mousePos3D;
    float distToEllipsoid = length(vec3(distVec.x / ellipsoidRadiusXY, distVec.y / ellipsoidRadiusXY, distVec.z / ellipsoidRadiusZ));

    if (distToEllipsoid < 1.0) {

        vec3 dirToEllipsoid = normalize(distVec / vec3(ellipsoidRadiusXY, ellipsoidRadiusXY, ellipsoidRadiusZ));
        pos += dirToEllipsoid * 0.3 * smoothstep(1.0, 0.0, distToEllipsoid);
    }

    gl_FragColor = vec4(pos, 1.0);

  }
`;