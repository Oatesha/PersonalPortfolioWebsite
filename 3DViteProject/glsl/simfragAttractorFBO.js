export const simfragFBO = /* glsl */`

precision mediump float;
uniform sampler2D posTex;
uniform float time;

varying vec2 vUv;


  vec3 thomasAttractor(vec3 pos) {
    float b = 0.5;
    
    // Timestep 
    float dt = 0.05;
    
    float x = pos.x;
    float y = pos.y;
    float z = pos.z;
    
    float dx, dy, dz;
    
    dx = (-b*x + sin(y)) * dt;
    dy = (-b*y + sin(z)) * dt;
    dz = (-b*z + sin(x)) * dt;
    
    return vec3(dx, dy, dz);
  }
    
void main() {
    vec3 pos = texture2D(posTex, vUv).xyz;
    
    
    
    gl_FragColor = vec4(pos,1.0);
}
`;