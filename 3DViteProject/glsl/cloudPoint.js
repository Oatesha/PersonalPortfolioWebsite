export const cloudPointVert = /* glsl */`

  uniform sampler2D posTex;
  uniform sampler2D targetTexA;
  uniform sampler2D targetTexB;
  uniform float targetMix;
  uniform float pointSize;
  // 1 where a slot's colours are the model's own and want grading to the page.
  // 0 where they were picked, as a company mark's are
  uniform float gradeA;
  uniform float gradeB;

  varying vec3 vBaseColour;
  varying float vSpeed;
  varying float vGrade;

  // three 8 bit channels packed into one float by samplePositions
  vec3 unpackColour(float packed) {
    int rgb = int(packed);
    return vec3(
      float((rgb >> 16) & 0xFF),
      float((rgb >>  8) & 0xFF),
      float( rgb        & 0xFF)
    ) / 255.0;
  }

  void main() {
    // position holds the sim texel this particle owns, not a place in the world
    vec4 state = texture2D(posTex, position.xy);

    vBaseColour = mix(
      unpackColour(texture2D(targetTexA, position.xy).a),
      unpackColour(texture2D(targetTexB, position.xy).a),
      targetMix
    );
    vGrade = mix(gradeA, gradeB, targetMix);
    vSpeed = state.a;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(state.xyz, 1.0);
    gl_PointSize = pointSize;
  }

`;

export const cloudPointFrag = /* glsl */`

// 0 paints the target's own colours and 1 paints particle speed
uniform float colourMix;
uniform vec3 rampLow;
uniform vec3 rampMid;
uniform vec3 rampHigh;
uniform vec3 baseGain;
uniform float baseDesaturate;
uniform vec3 baseTint;
varying vec3 vBaseColour;
varying float vSpeed;
varying float vGrade;

// most particles sit near 1.0 so the interesting range is roughly 0 to 3. see
// NOMINAL_STEP in cloudSim
vec3 speedColour(float speed) {
    float t = clamp(speed / 2.6, 0.0, 1.0);
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
