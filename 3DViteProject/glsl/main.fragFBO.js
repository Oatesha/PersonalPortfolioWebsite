export const fragmentShader = /* glsl */`


uniform float u_time; 
uniform sampler2D uTexture;
varying vec2 vUv;
varying float vColour; 

void main() {
    int RGBPacked = floatBitsToInt(vColour);
    float r = float((RGBPacked >> 16) & 0xFF) / 255.0;
    float g = float((RGBPacked >>  8) & 0xFF) / 255.0;
    float b = float((RGBPacked) & 0xFF) / 255.0;

    gl_FragColor = vec4(r, g, b, 1.0);
}
`;