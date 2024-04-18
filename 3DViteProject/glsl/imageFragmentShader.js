export const imageFragmentShader = /* glsl */`

varying vec2 vUv;
uniform sampler2D u_texture;
uniform vec2 u_Mouse;
uniform vec2 u_PrevMouse;
uniform float u_aberrationIntensity;

void main() {
    vec2 gridUV = floor(vUv * vec2(10.0, 10.0)) / vec2(10.0, 10.0);
    vec2 centerOfPixel = gridUV + vec2(1.0/10.0, 1.0/10.0);

    vec2 mouseDirection = u_PrevMouse - u_Mouse;
        
    vec2 pixelToMouseDirection = centerOfPixel - u_Mouse;
    float pixelDistanceToMouse = length(pixelToMouseDirection);
    float strength = smoothstep(0.2, 0.0, pixelDistanceToMouse);

    vec2 uvOffset = strength * - mouseDirection;
    vec2 uv = vUv - uvOffset;
    

    vec4 colorR = texture2D(u_texture, uv + vec2(strength * u_aberrationIntensity * 0.005, 0.0));
    vec4 colorG = texture2D(u_texture, uv);
    vec4 colorB = texture2D(u_texture, uv - vec2(strength * u_aberrationIntensity * 0.005, 0.0));
    gl_FragColor = vec4(colorR.r, colorG.g, colorB.b, 1.0);



    
}
`;