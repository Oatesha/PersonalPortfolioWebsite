export const simfragFBO = /* glsl */`

  uniform sampler2D posTex;
  uniform sampler2D originalPosTex;
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
  vec3 mod289(vec3 x) {
    return x - floor(x * (1.0 / 289.0)) * 289.0;
  }
  
  vec4 mod289(vec4 x) {
    return x - floor(x * (1.0 / 289.0)) * 289.0;
  }
  
  vec4 permute(vec4 x) {
       return mod289(((x*34.0)+1.0)*x);
  }
  
  vec4 taylorInvSqrt(vec4 r)
  {
    return 1.79284291400159 - 0.85373472095314 * r;
  }
  
  float snoise(vec3 v)
    {
    const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
    const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
  
  // First corner
    vec3 i  = floor(v + dot(v, C.yyy) );
    vec3 x0 =   v - i + dot(i, C.xxx) ;
  
  // Other corners
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min( g.xyz, l.zxy );
    vec3 i2 = max( g.xyz, l.zxy );
  
    //   x0 = x0 - 0.0 + 0.0 * C.xxx;
    //   x1 = x0 - i1  + 1.0 * C.xxx;
    //   x2 = x0 - i2  + 2.0 * C.xxx;
    //   x3 = x0 - 1.0 + 3.0 * C.xxx;
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy; // 2.0*C.x = 1/3 = C.y
    vec3 x3 = x0 - D.yyy;      // -1.0+3.0*C.x = -0.5 = -D.y
  
  // Permutations
    i = mod289(i);
    vec4 p = permute( permute( permute(
               i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
             + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
             + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
  
  // Gradients: 7x7 points over a square, mapped onto an octahedron.
  // The ring size 17*17 = 289 is close to a multiple of 49 (49*6 = 294)
    float n_ = 0.142857142857; // 1.0/7.0
    vec3  ns = n_ * D.wyz - D.xzx;
  
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);  //  mod(p,7*7)
  
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_ );    // mod(j,N)
  
    vec4 x = x_ *ns.x + ns.yyyy;
    vec4 y = y_ *ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
  
    vec4 b0 = vec4( x.xy, y.xy );
    vec4 b1 = vec4( x.zw, y.zw );
  
    //vec4 s0 = vec4(lessThan(b0,0.0))*2.0 - 1.0;
    //vec4 s1 = vec4(lessThan(b1,0.0))*2.0 - 1.0;
    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
  
    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
  
    vec3 p0 = vec3(a0.xy,h.x);
    vec3 p1 = vec3(a0.zw,h.y);
    vec3 p2 = vec3(a1.xy,h.z);
    vec3 p3 = vec3(a1.zw,h.w);
  
  //Normalise gradients
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;
  
  // Mix final noise value
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1),
                                  dot(p2,x2), dot(p3,x3) ) );
    }
  
  
  vec3 snoiseVec3( vec3 x ){
  
    float s  = snoise(vec3( x ));
    float s1 = snoise(vec3( x.y - 19.1 , x.z + 33.4 , x.x + 47.2 ));
    float s2 = snoise(vec3( x.z + 74.2 , x.x - 124.5 , x.y + 99.4 ));
    vec3 c = vec3( s , s1 , s2 );
    return c;
  
  }
  
  
  vec3 curlNoise( vec3 p ){
    
    const float e = .1;
    vec3 dx = vec3( e   , 0.0 , 0.0 );
    vec3 dy = vec3( 0.0 , e   , 0.0 );
    vec3 dz = vec3( 0.0 , 0.0 , e   );
  
    vec3 p_x0 = snoiseVec3( p - dx );
    vec3 p_x1 = snoiseVec3( p + dx );
    vec3 p_y0 = snoiseVec3( p - dy );
    vec3 p_y1 = snoiseVec3( p + dy );
    vec3 p_z0 = snoiseVec3( p - dz );
    vec3 p_z1 = snoiseVec3( p + dz );
  
    float x = p_y1.z - p_y0.z - p_z1.y + p_z0.y;
    float y = p_z1.x - p_z0.x - p_x1.z + p_x0.z;
    float z = p_x1.y - p_x0.y - p_y1.x + p_y0.x;
  
    const float divisor = 1.0 / ( 2.0 * e );
    return normalize( vec3( x , y , z ) * divisor );
  
  }

  vec2 rotate(vec2 v, float a) {
    float s = sin(a);
    float c = cos(a);
    mat2 m = mat2(c, s, -s, c);
    return m * v;
  }

  // Add a function to calculate the force vector towards the original curled position
  vec3 forceToOriginalPos(vec3 currentPos, vec3 originalPos) {
      // Calculate the direction towards the original position
      vec3 direction = originalPos - currentPos;
      // Normalize the direction vector to get the unit vector
      return normalize(direction);
  }

  float frequency = 0.2;
  float amplit = 0.5;
  float maxDistance = 2.;
  void main() {

    // Read the supplied x, y, z vert positions
    vec3 pos = texture2D(posTex, vUv).xyz;
    // vec3 dpos = thomasAttractor(pos);
    // pos.x += dpos.x;
    // pos.y += dpos.y;
    // pos.z += dpos.z;


    
    
    
    
    
    // vec3 tar = pos + curlNoise(vec3(pos.x * frequency, pos.y * frequency, pos.z * frequency)) * amplit;
    // float d = length(pos - tar) / maxDistance;
    // pos = mix(pos, tar, pow(d, 5.));
    
    vec3 mousePos3D = vec3(mouse.xy, 0.0);
    float ellipsoidRadiusXY = 2.0;
    float ellipsoidRadiusZ = 10.0; 
    
    // Calculate the distance from the particle position to the ellipsoid center
    vec3 distVec = pos - mousePos3D;
    float distToEllipsoid = length(vec3(distVec.x / ellipsoidRadiusXY, distVec.y / ellipsoidRadiusXY, distVec.z / ellipsoidRadiusZ));
    
    if (distToEllipsoid < 1.0) {
      
      vec3 dirToEllipsoid = normalize(distVec / vec3(ellipsoidRadiusXY, ellipsoidRadiusXY, ellipsoidRadiusZ));
      pos += dirToEllipsoid * 0.003 * smoothstep(1.0, 0.0, distToEllipsoid);
    }
    
    // // Read the original position without mouse
    // vec3 originalPos = texture2D(originalPosTex, vUv).xyz;
    
    // // Calculate the force vector towards the original curled position
    // vec3 force = forceToOriginalPos(pos, originalPos);
    
    // // Apply a constant force magnitude in the direction towards the original position
    // float forceMagnitude = 0.1; // Adjust as needed
    // pos += force * forceMagnitude;

    // Rotate the particle positions around the Y-axis
    float x = pos.x * cos(0.001) + pos.z * sin(0.001);
    float z = -pos.x * sin(0.001) + pos.z * cos(0.001);
    pos.x = x;
    pos.z = z;



    gl_FragColor = vec4(pos, 1.0);


  }
`;