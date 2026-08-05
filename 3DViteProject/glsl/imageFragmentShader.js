export const imageFragmentShader = /* glsl */`

varying vec2 vUv;
uniform sampler2D u_texture;
uniform vec2 u_Mouse;
uniform vec2 u_PrevMouse;
uniform float u_aberrationIntensity;
uniform float u_planeAspect;
uniform float u_texAspect;

// Maps plane space into texture space so the screenshot keeps its own aspect
// ratio whatever shape the box is, letterboxing the remainder. This is what
// used to be attempted by scaling a 21:9 plane and bending the camera's fov.
vec2 containUv(vec2 uv) {
    vec2 s = (u_texAspect > u_planeAspect)
        ? vec2(1.0, u_texAspect / u_planeAspect)
        : vec2(u_planeAspect / u_texAspect, 1.0);
    return (uv - 0.5) * s + 0.5;
}

void main() {
    vec2 gridUV = floor(vUv * 10.0) / 10.0;
    vec2 centerOfPixel = gridUV + vec2(0.1);

    vec2 mouseDirection = u_PrevMouse - u_Mouse;
    float pixelDistanceToMouse = length(centerOfPixel - u_Mouse);
    float strength = smoothstep(0.2, 0.0, pixelDistanceToMouse);

    vec2 uv = containUv(vUv + strength * mouseDirection);

    float shift = strength * u_aberrationIntensity * 0.005;
    vec4 colorR = texture2D(u_texture, uv + vec2(shift, 0.0));
    vec4 colorG = texture2D(u_texture, uv);
    vec4 colorB = texture2D(u_texture, uv - vec2(shift, 0.0));

    // Transparent outside the image rather than smearing clamped edge texels.
    vec2 inside = step(vec2(0.0), uv) * step(uv, vec2(1.0));

    gl_FragColor = vec4(colorR.r, colorG.g, colorB.b, inside.x * inside.y);
}
`;
