export const fragmentShader = /* glsl */`


void main() {

  vec3 rgb = vec3(102, 252, 241) * 1.0/255.0;

  gl_FragColor = vec4(rgb, 1.0);
}


`;