export const vertexShader = /* glsl */`

uniform float attractor;
uniform sampler2D positions;

varying vec2 vUv;
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
  
  vec3 lorezMod2Attractor(vec3 pos) {

      // Lorenz Mod2 Attractor parameters
      float a = 0.9;
      float b = 5.0;
      float c = 9.9;
      float d = 1.0;
      
      // Timestep
      float dt = 0.0005;
      
      float x = pos.x;
      float y = pos.y;
      float z = pos.z;
      
      float dx, dy, dz;
      
      dx = (-a*x+ y*y - z*z + a *c) * dt;
      dy = (x*(y-b*z)+d)  * dt;
      dz = (-z + x*(b*y +z))  * dt;
      
      return vec3(dx, dy, dz);
    }
    
    vec3 thomasAttractor(vec3 pos) {
      float b = 0.19;
      
      // Timestep 
      float dt = 0.01;
      
      float x = pos.x;
      float y = pos.y;
      float z = pos.z;
      
      float dx, dy, dz;
      
      dx = (-b*x + sin(y)) * dt;\n  dy = (-b*y + sin(z)) * dt;
      dz = (-b*z + sin(x)) * dt;
      
      return vec3(dx, dy, dz);
    }
    
    vec3 dequanAttractor(vec3 pos) {
      float a = 40.0;
      float b = 1.833;
      float c = 0.16;
      float d = 0.65;
      float e = 55.0;
      float f = 20.0;
      
      // Timestep \n  float dt = 0.0005;
      
      float x = pos.x;
      float y = pos.y;
      float z = pos.z;
      
      float dx, dy, dz;
      
      dx = ( a*(y-x) + c*x*z) * dt;
      dy = (e*x + f*y - x*z) * dt;
      dz = (b*z + x*y - d*x*x) * dt;
      
      return vec3(dx, dy, dz);
    }
    
    vec3 dradasAttractor(vec3 pos) {
      float a = 3.0;\n  float b = 2.7;
      float c = 1.7;\n  float d = 2.0;
      float e = 9.0;
      
      // Timestep 
      float dt = 0.0020;
      
      float x = pos.x;
      float y = pos.y;
      float z = pos.z;
      
      float dx, dy, dz;
      dx = (y- a*x +b*y*z) * dt;
      dy = (c*y -x*z +z) * dt;
      dz = (d*x*y - e*z) * dt;
      
      return vec3(dx, dy, dz);
    }
      
    vec3 arneodoAttractor(vec3 pos) {
      float a = -5.5;
      float b = 3.5;
      float d = -1.0;
      
      // Timestep 
      float dt = 0.0020;
      
      float x = pos.x;
      float y = pos.y;
      float z = pos.z;
      
      float dx, dy, dz;
      
      dx = y * dt;
      dy = z * dt;
      dz = (-a*x -b*y -z + (d* (pow(x, 3.0)))) * dt;
      return vec3(dx, dy, dz);
    }
    vec3 aizawaAttractor(vec3 pos) {
      float a = 0.95;
      float b = 0.7;
      float c = 0.6;
      float d = 3.5;
      float e = 0.25;
      float f = 0.1;
      
      // Timestep 
      float dt = 0.003;
      
      float x = pos.x;
      float y = pos.y;
      float z = pos.z;
      
      float dx, dy, dz;
      
      dx = ((z-b) * x - d*y) * dt;
      dy = (d * x + (z-b) * y) * dt;
      dz = (c + a*z - ((z*z*z) / 3.0) - (x*x) + f * z * (x*x*x)) * dt;
      
      return vec3(dx, dy, dz);
    }
    
    void main() {
        vec3 pos = texture2D(positions, vUv).rgb;
        vec3 delta;
        
        if(attractor == 0.0) {
          delta = lorezAttractor(pos);
        }
        
        if(attractor == 1.0) {
          delta = lorezMod2Attractor(pos);
        }
        
        if(attractor == 2.0) {
          delta = thomasAttractor(pos);
        }
        
        if(attractor == 3.0) {
          delta = dequanAttractor(pos);
        }
        
        if(attractor == 4.0) {
          delta = dradasAttractor(pos);
        }
        
        if(attractor == 5.0) {
          delta = arneodoAttractor(pos);
        }
        
        if(attractor == 6.0) {
          delta = aizawaAttractor(pos);
        }
        
        pos.x += delta.x;
        pos.y += delta.y;
        pos.z += delta.z;
        
        // pos.x += cos(pos.y) / 100.0;
        // pos.y += tan(pos.x) / 100.0;
        
        gl_FragColor = vec4(pos,1.0);
      }



`;


