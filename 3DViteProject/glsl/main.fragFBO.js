export const fragmentShader = /* glsl */`


uniform float u_time; // Uniform variable to pass time
uniform sampler2D uTexture;
varying vec2 vUv;

void main() {

    vec3 RGB = vec3(102./255., 252./255., 241./255.);

    gl_FragColor = vec4(RGB, 1.0);
}


`;