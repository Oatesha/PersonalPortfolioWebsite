import { imageLayout } from './imageLayout.js';

// state carries position in xy and velocity in zw, both in the panel's plane
// space where -1 -1 is its bottom left corner whatever shape the panel is
export const imageSimFrag = /* glsl */`

  ${imageLayout}

  uniform sampler2D posTex;
  uniform float planeAspect;
  uniform float texAspect;
  uniform vec2 mouse;
  uniform float mouseActive;
  uniform float dtScale;
  // 1 at the moment the screenshot changes, then tweened to 0 over the switch
  uniform float burst;

  varying vec2 vUv;

  // deliberately under damped. critically damped is dead and looks it
  const float SPRING = 0.055;
  const float DAMPING = 0.86;

  const float MOUSE_RADIUS = 0.26;
  const float MOUSE_PUSH = 0.012;

  const float BURST_SPEED = 0.005;
  // how much of the spring the burst takes away at its peak
  const float BURST_RELEASE = 0.9;

  // the screenshot is fitted inside the panel rather than stretched to it
  vec2 homePosition(vec2 texel) {
    vec2 fit = (texAspect > planeAspect)
      ? vec2(1.0, planeAspect / texAspect)
      : vec2(texAspect / planeAspect, 1.0);

    return (imagePoint(virtualCell(texel).xy) * 2.0 - 1.0) * fit;
  }

  void main() {
    vec4 state = texture2D(posTex, vUv);
    vec2 pos = state.xy;
    vec2 vel = state.zw;

    float spring = SPRING * (1.0 - BURST_RELEASE * burst);
    vel += (homePosition(vUv) - pos) * spring * dtScale;

    // the panel is two plane units across whatever its shape, so a radius in
    // plane units is an ellipse on screen. measure in pixel shaped space and
    // convert the push back before applying it
    vec2 toPointer = (pos - mouse) * vec2(planeAspect, 1.0);
    float dist = length(toPointer);

    if (mouseActive > 0.5 && dist < MOUSE_RADIUS) {
      vec2 dir = dist > 1e-4 ? toPointer / dist : vec2(1.0, 0.0);
      vel += (dir / vec2(planeAspect, 1.0))
        * MOUSE_PUSH * smoothstep(MOUSE_RADIUS, 0.0, dist) * dtScale;
    }

    if (burst > 0.0) {
      vec2 jitter = vec2(random(vUv), random(vUv + 3.7)) * 2.0 - 1.0;
      vec2 scatter = jitter + pos * 0.5;
      float len = length(scatter);
      vec2 dir = len > 1e-4 ? scatter / len : vec2(1.0, 0.0);
      vel += dir * burst * BURST_SPEED * dtScale;
    }

    // raised to dtScale rather than multiplied by it. damping compounds per
    // frame so two half steps have to lose what one whole step does
    vel *= pow(DAMPING, dtScale);
    pos += vel * dtScale;

    gl_FragColor = vec4(pos, vel);
  }
`;
