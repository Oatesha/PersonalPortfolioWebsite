import { gsap } from "gsap";
import { getSimMaterial, getRenderMaterial, shipFraming, setCloudTarget, getShipTarget } from "./main.js";
import { rig } from "./cameraRig.js";

// what the cloud is. the ship or one of five attractors and the transitions
// between them. the shader normalises every attractor to one centre and radius
// but the ship is thirty eight units across so moving to or from it tweens the
// framing too

// order and indices must match the constants in the shader. see the note above
// attractorCentre in glsl/simfragFBO.js before adding one
export const ATTRACTORS = [
  { name: "Thomas" },
  { name: "Lorenz" },
  { name: "Rössler" },
  { name: "Halvorsen" },
  { name: "Dadras" },
];

// not an attractor. state 0 in the shader
const SHIP = -1;

// state 0 too but pulling to a target sampled from an svg. no button owns it
const MARK = -2;

// the personal project panel always shows this one
const PROJECT_ATTRACTOR = 4;

// how long the ship holds from the end of the landing intro
const SHIP_HOLD = 10;

// how long each attractor is held before the cycle moves on
const CYCLE_INTERVAL = 10;

// the burst is a half sine over this so the cloud is most scattered halfway
const MORPH_DURATION = 2.4;

// framing radius once the cloud is an attractor. the ship's own comes from the
// GLB via shipFraming
const ATTRACTOR_RADIUS = 4;

let current = SHIP;
// set by the first press of a shape button. the cycle never takes over again
let manual = false;
let cycling = false;
let morphTween = null;
let cycleCall = null;
let holdCall = null;
const buttons = [];

// ship first then the attractors
const SHAPES = [{ name: "Ship", index: SHIP }].concat(
  ATTRACTORS.map((attractor, index) => ({ name: attractor.name, index })),
);

export function currentShape() {
  return current;
}

// starts the clock that ends the ship. called when the landing intro finishes
export function holdShipThenStart() {
  if (manual || current !== SHIP) {
    return;
  }
  holdCall?.kill();
  holdCall = gsap.delayedCall(SHIP_HOLD, () => advance());
}

// scrolling past the landing is the other way to end the ship's hold
export function startAttractorMode() {
  if (manual || current !== SHIP) {
    return;
  }
  holdCall?.kill();
  advance();
}

// a press on one of the shape buttons
export function selectShape(index) {
  manual = true;
  cycling = false;
  holdCall?.kill();
  cycleCall?.kill();
  cycleCall = null;
  applyShape(index);
}

// pins the cloud for the project panel and stops the clock
export function lockAttractor(index = PROJECT_ATTRACTOR) {
  cycling = false;
  holdCall?.kill();
  cycleCall?.kill();
  cycleCall = null;
  applyShape(index);
}

// hands the cloud to a company mark and stops the clock
export function showMark(texture, framing) {
  const sim = getSimMaterial();
  const rend = getRenderMaterial();

  if (!sim || !rend) {
    return;
  }

  cycling = false;
  holdCall?.kill();
  cycleCall?.kill();
  cycleCall = null;
  morphTween?.kill();

  current = MARK;
  syncButtons();

  sim.uniforms.state.value = 0;
  // a mark's colours are the company's so they are left as sampled
  setCloudTarget(texture, { graded: 0 });
  tweenFraming(rend, framing.radius, framing.extent, 0);
}

// back to the ship
export function clearMark() {
  if (current !== MARK) {
    return;
  }

  current = SHIP;
  applyShapeToShip();
}

function applyShapeToShip() {
  const sim = getSimMaterial();
  const rend = getRenderMaterial();

  if (!sim || !rend) {
    return;
  }

  syncButtons();
  sim.uniforms.state.value = 0;
  setCloudTarget(getShipTarget());
  tweenFraming(rend, shipFraming.radius, shipFraming.extent, 0);
}

export function resumeCycle() {
  // someone who picked a shape by hand keeps it
  if (manual || current === SHIP) {
    return;
  }
  cycling = true;
  scheduleNext();
}

function advance() {
  cycling = true;
  const next = current === SHIP ? 0 : (current + 1) % ATTRACTORS.length;
  applyShape(next);
}

function applyShape(index) {
  const sim = getSimMaterial();
  const rend = getRenderMaterial();

  // the buttons exist from first paint. the sim does not
  if (!sim || !rend || index === current) {
    return;
  }

  const fromShip = current === SHIP;
  current = index;
  syncButtons();

  if (index === SHIP) {
    // no burst on the way back. state 0 reassembles the hull by itself
    sim.uniforms.state.value = 0;
    // the target may still be a mark coming back from the work section
    setCloudTarget(getShipTarget());
    tweenFraming(rend, shipFraming.radius, shipFraming.extent, 0);
    scheduleNext();
    return;
  }

  // from the ship there is no previous field so both ends are the same
  // attractor and the burst does the work
  sim.uniforms.attractorFrom.value = fromShip
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

// overwrite auto throughout so a press part way through a transition takes
// these over rather than fighting the tween on them
function tweenFraming(rend, radius, extent, colourMix) {
  gsap.to(rig, { radius, duration: MORPH_DURATION, ease: "power2.inOut", overwrite: "auto" });
  gsap.to(rig.extent, { ...extent, duration: MORPH_DURATION, ease: "power2.inOut", overwrite: "auto" });
  // baked colours on the hull and speed on an attractor
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
    button.setAttribute("aria-pressed", String(SHAPES[position].index === current));
  });
}

function initShapeSwitch() {
  const list = document.querySelector(".attractor-switch");
  if (!list) {
    return;
  }

  SHAPES.forEach((shape) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "attractor-option";
    button.textContent = shape.name;
    button.setAttribute("aria-pressed", String(shape.index === current));
    button.addEventListener("click", () => selectShape(shape.index));
    list.appendChild(button);
    buttons.push(button);
  });

  list.setAttribute("aria-label", "Shape");
}

initShapeSwitch();
