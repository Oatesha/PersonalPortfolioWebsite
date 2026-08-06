import { gsap } from "gsap";
import { getSimMaterial, getRenderMaterial, shipFraming } from "./main.js";
import { rig } from "./cameraRig.js";

// what the cloud is: the ship or one of five attractors, and the transitions
// between them. the shader normalises every attractor to one centre and radius
// so switching between them never moves the camera, but the ship is thirty
// eight units across against an attractor's four, so moving to or from it
// tweens the framing too

// order and indices must match the constants in the shader. adding one isn't
// just dropping in its equations, particles land on it from well outside so it
// has to pull them in rather than drop them in a fixed point or fling them off
// to infinity. see the note above attractorCentre in glsl/simfragFBO.js
export const ATTRACTORS = [
  { name: "Thomas" },
  { name: "Lorenz" },
  { name: "Rössler" },
  { name: "Halvorsen" },
  { name: "Dadras" },
];

// the ship isn't an attractor, in the shader it is state 0 rather than an
// entry in the table
const SHIP = -1;

// the personal project panel always shows this one so its screenshot is the
// same image every time
const PROJECT_ATTRACTOR = 4;

// how long the ship holds before it comes apart, measured from the end of the
// landing intro so it doesn't depend on how long the GLB took to load
const SHIP_HOLD = 10;

// how long each attractor is held before the cycle moves on
const CYCLE_INTERVAL = 10;

// long enough to read as a transformation rather than a cut. the burst is a
// half sine over this so the cloud is most scattered halfway through
const MORPH_DURATION = 2.4;

// framing radius once the cloud is an attractor, measured off the settled
// cloud. the ship's own framing comes from the GLB via shipFraming
const ATTRACTOR_RADIUS = 4;

let current = SHIP;
// set by the first press of a shape button. the cycle is for someone who leaves
// the page alone, once you've driven it yourself it stops taking the wheel back
let manual = false;
let cycling = false;
let morphTween = null;
let cycleCall = null;
let holdCall = null;
const buttons = [];

// ship first, then the attractors
const SHAPES = [{ name: "Ship", index: SHIP }].concat(
  ATTRACTORS.map((attractor, index) => ({ name: attractor.name, index })),
);

export function currentShape() {
  return current;
}

// starts the clock that ends the ship, called when the landing intro finishes
// so the ship is fully assembled before the countdown starts
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

  // the buttons exist from first paint but the sim is built behind the GLB and
  // the gpu tier probe, so a press can land before there's anything to drive
  if (!sim || !rend || index === current) {
    return;
  }

  const fromShip = current === SHIP;
  current = index;
  syncButtons();

  if (index === SHIP) {
    // no burst on the way back, state 0 pulls each particle towards its own
    // point on the hull and that reassembles the ship by itself
    sim.uniforms.state.value = 0;
    tweenFraming(rend, shipFraming.radius, shipFraming.extent, 0);
    scheduleNext();
    return;
  }

  // coming from the ship there's no previous field, so both ends are the same
  // attractor and the burst does the work. otherwise start from whichever field
  // is driving the cloud right now, the same test the shader makes
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

// overwrite auto throughout so a press part way through a previous transition
// takes these over instead of fighting the tween already on them
function tweenFraming(rend, radius, extent, colourMix) {
  gsap.to(rig, { radius, duration: MORPH_DURATION, ease: "power2.inOut", overwrite: "auto" });
  gsap.to(rig.extent, { ...extent, duration: MORPH_DURATION, ease: "power2.inOut", overwrite: "auto" });
  // the ship's colours mean nothing on a shape that isn't a ship, and speed
  // means nothing on a static hull, so the two crossfade with the shape
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
