export const simfragFBO = /* glsl */`

  uniform sampler2D posTex;
  uniform sampler2D originalPosTex;
  uniform sampler2D textPosTex;
  uniform vec2 mouse;
  uniform int state;
  uniform float maxDist;
  uniform float mixValue;
  uniform float time;

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


  vec3 deriv(vec3 pos) {
    return vec3(
      3.0 * pos.x * (1.0 - pos.y) - 2.20 * pos.z,
      -1.0 * pos.y * (1.0 - pos.x * pos.x),
      1.510 * pos.x
    ) * 0.005;
  }

  vec3 dequan(vec3 pos) {
    float timestep = 0.0007;

    float dx, dy, dz;
    float x = pos.x;
    float y = pos.y;
    float z = pos.z;

    float a = 0.9;
    float b = 5.0;
    float c = 9.9;
    float d = 1.0;
            
    dx = (-a*x+ y*y - z*z + a *c) * timestep;
    dy = (x*(y-b*z)+d)  * timestep;
    dz = (-z + x*(b*y +z))  * timestep;

    return vec3(dx, dy, dz);
  }

  float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) *
        43758.5453123);
}

vec3 mod289(vec3 x) {
    return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec2 mod289(vec2 x) {
    return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec3 permute(vec3 x) {
    return mod289(((x * 34.0) + 1.0) * x);
}

float noise(vec2 v) {
    const vec4 C = vec4(0.211324865405187,  // (3.0-sqrt(3.0))/6.0
    0.366025403784439,  // 0.5*(sqrt(3.0)-1.0)
    -0.577350269189626,  // -1.0 + 2.0 * C.x
    0.024390243902439); // 1.0 / 41.0
    // First corner
    vec2 i = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);

    // Other corners
    vec2 i1;
    //i1.x = step( x0.y, x0.x ); // x0.x > x0.y ? 1.0 : 0.0
    //i1.y = 1.0 - i1.x;
    i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    // x0 = x0 - 0.0 + 0.0 * C.xx ;
    // x1 = x0 - i1 + 1.0 * C.xx ;
    // x2 = x0 - 1.0 + 2.0 * C.xx ;
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;

    // Permutations
    i = mod289(i); // Avoid truncation effects in permutation
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));

    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
    m = m * m;
    m = m * m;

    // Gradients: 41 points uniformly over a line, mapped onto a diamond.
    // The ring size 17*17 = 289 is close to a multiple of 41 (41*7 = 287)

    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;

    // Normalise gradients implicitly by scaling m
    // Approximation of: m *= inversesqrt( a0*a0 + h*h );
    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);

    // Compute final noise value at P
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
}

vec3 curl(float x, float y, float z) {

    float eps = 1., eps2 = 2. * eps;
    float n1, n2, a, b;

    x += time * .05;
    y += time * .05;
    z += time * .05;

    vec3 curl = vec3(0.);

    n1 = noise(vec2(x, y + eps));
    n2 = noise(vec2(x, y - eps));
    a = (n1 - n2) / eps2;

    n1 = noise(vec2(x, z + eps));
    n2 = noise(vec2(x, z - eps));
    b = (n1 - n2) / eps2;

    curl.x = a - b;

    n1 = noise(vec2(y, z + eps));
    n2 = noise(vec2(y, z - eps));
    a = (n1 - n2) / eps2;

    n1 = noise(vec2(x + eps, z));
    n2 = noise(vec2(x + eps, z));
    b = (n1 - n2) / eps2;

    curl.y = a - b;

    n1 = noise(vec2(x + eps, y));
    n2 = noise(vec2(x - eps, y));
    a = (n1 - n2) / eps2;

    n1 = noise(vec2(y + eps, z));
    n2 = noise(vec2(y - eps, z));
    b = (n1 - n2) / eps2;

    curl.z = a - b;

    return curl;
}

// Add a function to calculate the force vector towards the original position
vec3 forceToOriginalPos(vec3 currentPos, vec3 originalPos) {
    // Calculate the direction towards the original position
    vec3 direction = originalPos - currentPos;
    // Normalize the direction vector to get the unit vector
    return normalize(direction);
}

  float frequency = 0.35;
  float amplitude = 0.09;
  void main() {

    float maxDistance = maxDist;
    // Read the supplied x, y, z vert positions
    vec3 pos = texture2D(posTex, vUv).xyz;
    // vec3 dpos = thomasAttractor(pos);
    // pos.x += dpos.x;
    // pos.y += dpos.y;
    // pos.z += dpos.z;


    // Read the original position without mouse
    vec3 originalPos = texture2D(originalPosTex, vUv).xyz;
    vec3 textPos = texture2D(textPosTex, vUv).xyz;
  
    
    
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
    
    vec3 force = forceToOriginalPos(pos, mix(originalPos, textPos, mixValue));
    pos += force * 0.05;


    
    

    gl_FragColor = vec4(pos, 1.0);


  }
`;