export const fragmentShader = /* glsl */`


uniform float u_time; // Uniform variable to pass time
uniform sampler2D uTexture;
varying vec2 vUv;

void main() {


    gl_FragColor = vec4(1.0);
}


`;