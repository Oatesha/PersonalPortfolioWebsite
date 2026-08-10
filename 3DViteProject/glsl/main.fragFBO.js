export const fragmentShader = /* glsl */`


// 0 paints the target's own colours and 1 paints particle speed
uniform float colourMix;
// the speed ramp and the gain on the target's own colours. handed over by
// theme.js from the css tokens the page is painted with
uniform vec3 rampLow;
uniform vec3 rampMid;
uniform vec3 rampHigh;
uniform vec3 baseGain;
// how far the target's own colours are pulled towards their luma and the hue
// that luma is tinted back into
uniform float baseDesaturate;
uniform vec3 baseTint;
varying vec3 vBaseColour;
varying float vSpeed;
varying float vGrade;

// speed ramp. most particles sit near 1.0 so the interesting range is roughly
// 0 to 3. see NOMINAL_STEP in the sim
vec3 speedColour(float speed) {
    float t = clamp(speed / 2.6, 0.0, 1.0);

    // the distribution is bunched near the bottom so stretch that end out
    t = pow(t, 0.65);

    return t < 0.5 ? mix(rampLow, rampMid, t * 2.0) : mix(rampMid, rampHigh, (t - 0.5) * 2.0);
}

void main() {
    float luma = dot(vBaseColour, vec3(0.2126, 0.7152, 0.0722));
    vec3 graded = mix(vBaseColour, vec3(luma) * baseTint, baseDesaturate) * baseGain;
    vec3 base = mix(vBaseColour, graded, vGrade);

    gl_FragColor = vec4(mix(base, speedColour(vSpeed), colourMix), 1.0);
}
`;
