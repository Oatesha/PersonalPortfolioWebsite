export const imageFragmentShader = /* glsl */`

varying vec2 vUv;
uniform sampler2D u_texture;
uniform vec2 u_Mouse;
uniform vec2 u_PrevMouse;
uniform float u_aberrationIntensity;

void main() {
    vec2 gridUV = floor(vUv * vec2(20.0, 20.0)) / vec2(20.0, 20.0);
    vec2 centerOfPixel = gridUV + vec2(1.0/20.0, 1.0/20.0);
    vec2 pixelToMouseDirection = centerOfPixel - u_Mouse;
    float pixelDistanceToMouse = length(pixelToMouseDirection);
    float threshold = 0.1; // Adjust this value to change the distance threshold
    
    // Check if the pixel is close to the mouse position
    if (pixelDistanceToMouse < threshold) {
        gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0); // Red color
    } else {
        vec2 uvOffset = (pixelDistanceToMouse / threshold) * - u_Mouse * 0.2;
        vec2 uv = vUv - uvOffset;
        vec4 colorR = texture2D(u_texture, uv + vec2((pixelDistanceToMouse / threshold) * 0.5 * 0.01, 0.0));
        vec4 colorG = texture2D(u_texture, uv);
        vec4 colorB = texture2D(u_texture, uv - vec2((pixelDistanceToMouse / threshold) * 0.5 * 0.01, 0.0));
        vec3 colour = texture2D(u_texture, vUv).xyz;
        gl_FragColor = vec4(colour, 1.0);
    }
}
`;