export const simfragFBO = /* glsl */`

  uniform sampler2D posTex;

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
    float dt = 0.004;
    
    float x = pos.x;
    float y = pos.y;
    float z = pos.z;
    
    float dx, dy, dz;
    
    dx = dt * (a * (y - x));
    dy = dt * (x * (b - z) - y);
    dz = dt * (x * y - c * z);
    
    return vec3(dx, dy, dz);
  }

  void main() {

    // read the supplied x,y,z vert positions
    vec3 pos = texture2D(posTex, vUv).xyz;
    vec3 dpos = thomasAttractor(pos);

    pos.x += dpos.x;
    pos.y += dpos.y;
    pos.z += dpos.z;



    // render the new positional attributes
    gl_FragColor = vec4(pos, 1.0);
  }
`;