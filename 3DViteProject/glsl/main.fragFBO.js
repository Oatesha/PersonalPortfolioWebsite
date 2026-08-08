export const fragmentShader = /* glsl */`


// 0 paints the ship's own sampled colours, 1 paints particle speed
uniform float colourMix;
varying float vShipColour;
varying float vSpeed;

// speed ramp. most particles sit near 1.0 by construction, see NOMINAL_STEP in
// the sim, so the interesting range is roughly 0 to 3
vec3 speedColour(float speed) {
    float t = clamp(speed / 2.6, 0.0, 1.0);

    vec3 cool = vec3(0.02, 0.42, 0.45);
    vec3 mid  = vec3(0.48, 0.11, 0.72);
    vec3 hot  = vec3(1.00, 0.93, 0.86);

    // the distribution is bunched near the bottom, so stretch that end out
    // rather than painting most of the cloud one colour
    t = pow(t, 0.65);

    return t < 0.5 ? mix(cool, mid, t * 2.0) : mix(mid, hot, (t - 0.5) * 2.0);
}

void main() {
    int RGBPacked = int(vShipColour);
    float r = float((RGBPacked >> 16) & 0xFF) / 255.0;
    float g = float((RGBPacked >>  8) & 0xFF) / 255.0;
    float b = float((RGBPacked) & 0xFF) / 255.0;

    vec3 colour = mix(vec3(r, g, b), speedColour(vSpeed), colourMix);

    gl_FragColor = vec4(colour, 1.0);
}
`;
