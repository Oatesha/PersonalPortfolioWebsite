export const vertexShader = /* glsl */`

  uniform sampler2D posTex;
  // the two target slots, holding the ship or a company mark. colours are read
  // here so the sim's alpha channel is free to carry speed
  uniform sampler2D targetTexA;
  uniform sampler2D targetTexB;
  uniform float targetMix;
  uniform float pointSize;
  // 1 where a slot's colours are the model's own and want grading to the page,
  // 0 where they were chosen, as a company mark's are
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

    // unpacked here, once per particle, not once per pixel of the point
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
