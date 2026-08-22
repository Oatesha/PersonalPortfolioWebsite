import { gsap } from "gsap";
import { getSimMaterial, getRenderMaterial, setCloudTarget } from "./main.js";
import { rig } from "./cameraRig.js";

// order and indices must match the constants in glsl/cloudSim.js
const ATTRACTORS = ["Thomas", "Lorenz", "Rössler", "Halvorsen", "Dadras"];

// not an attractor. state 0, pulling to a target texture
const MARK = -2;

const PROJECT_ATTRACTOR = 4;

// the shape the landing settles on once the intro is done
const START_ATTRACTOR = 1;
const CYCLE_INTERVAL = 10;
// the burst is a half sine over this, so the cloud is most scattered halfway
const MORPH_DURATION = 2.4;

const ATTRACTOR_RADIUS = 4;

// nothing is applied until the sim is up
let current = -1;
// what to fall back to when a mark is dropped
let beforeMark = START_ATTRACTOR;
// set by the first press of a shape button. the cycle never takes over again
let manual = false;
let cycling = false;
let morphTween = null;
let cycleCall = null;
const buttons = [];

// the landing settles here as soon as the sim is up
export function startAttractorMode() {
  if (manual) {
    return;
  }
  cycling = true;
  applyShape(START_ATTRACTOR);
}

export function selectShape(index) {
  manual = true;
  cycling = false;
  cycleCall?.kill();
  cycleCall = null;
  applyShape(index);
}

// pins the cloud for the project panel and stops the clock
export function lockAttractor(index = PROJECT_ATTRACTOR) {
  cycling = false;
  cycleCall?.kill();
  cycleCall = null;
  applyShape(index);
}

// hands the cloud to a mark and stops the clock
export function showMark(texture, framing) {
  const sim = getSimMaterial();
  const rend = getRenderMaterial();

  if (!sim || !rend) {
    return;
  }

  cycling = false;
  cycleCall?.kill();
  cycleCall = null;
  morphTween?.kill();

  beforeMark = current === MARK ? beforeMark : current;
  current = MARK;
  syncButtons();

  sim.uniforms.state.value = 0;
  // a mark's colours are its own, so they are left as sampled
  setCloudTarget(texture, { graded: 0 });
  tweenFraming(rend, framing.radius, framing.extent, 0);
}

export function clearMark() {
  if (current !== MARK) {
    return;
  }

  applyShape(beforeMark);
}

export function resumeCycle() {
  // someone who picked a shape by hand keeps it
  if (manual) {
    return;
  }
  cycling = true;
  scheduleNext();
}

function advance() {
  cycling = true;
  const next = (current + 1) % ATTRACTORS.length;
  applyShape(next);
}

function applyShape(index) {
  const sim = getSimMaterial();
  const rend = getRenderMaterial();

  // the buttons exist from first paint. the sim does not
  if (!sim || !rend || index === current) {
    return;
  }

  // a mark is a target texture, not a field, so there is nothing to morph from
  const fromTarget = current === MARK;
  current = index;
  syncButtons();

  sim.uniforms.attractorFrom.value = fromTarget
    ? index
    : (sim.uniforms.morph.value < 0.5
        ? sim.uniforms.attractorFrom.value
        : sim.uniforms.attractorTo.value);
  sim.uniforms.attractorTo.value = index;
  sim.uniforms.state.value = 1;

  morphTween?.kill();
  sim.uniforms.morph.value = 0;
  morphTween = gsap.to(sim.uniforms.morph, {
    value: 1,
    duration: MORPH_DURATION,
    ease: "none",
  });

  tweenFraming(rend, ATTRACTOR_RADIUS, { x: 1, y: 1, z: 1 }, 1);
  scheduleNext();
}

// overwrite auto throughout so a press part way through a transition takes these
// over rather than fighting the tween on them
function tweenFraming(rend, radius, extent, colourMix) {
  gsap.to(rig, { radius, duration: MORPH_DURATION, ease: "power2.inOut", overwrite: "auto" });
  gsap.to(rig.extent, { ...extent, duration: MORPH_DURATION, ease: "power2.inOut", overwrite: "auto" });
  // baked colours on the hull, speed on an attractor
  gsap.to(rend.uniforms.colourMix, { value: colourMix, duration: MORPH_DURATION, ease: "none", overwrite: "auto" });
}

function scheduleNext() {
  cycleCall?.kill();
  if (!cycling) {
    cycleCall = null;
    return;
  }
  cycleCall = gsap.delayedCall(CYCLE_INTERVAL, advance);
}

function syncButtons() {
  buttons.forEach((button, position) => {
    button.setAttribute("aria-pressed", String(position === current));
  });
}

export function initShapeSwitch() {
  const list = document.querySelector(".attractor-switch");
  if (!list) {
    return;
  }

  ATTRACTORS.forEach((name, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "attractor-option";
    button.textContent = name;
    button.setAttribute("aria-pressed", String(index === current));
    button.addEventListener("click", () => selectShape(index));
    list.appendChild(button);
    buttons.push(button);
  });

  list.setAttribute("aria-label", "Shape");
}
