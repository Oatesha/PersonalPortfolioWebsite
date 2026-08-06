import { gsap } from "gsap";
import { getSimMaterial, getRenderMaterial } from "./main.js";
import { rig } from "./cameraRig.js";

// the chaotic attractors the cloud runs, and the one way trip from the ship
// into them. the shader normalises all of them to one centre and one radius so
// switching never moves the camera. the transition is a scatter and reform, see
// scatterDirection and the state == 1 branch in glsl/simfragFBO.js

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

// The personal project panel always shows this one, so the "screenshot" of the
// site is the same image every time it is navigated to.
const PROJECT_ATTRACTOR = 4;

// How long the ship hovers before it comes apart, measured from the end of the
// landing intro rather than from load, so the hold is the same length however
// long the GLB took to arrive.
const SHIP_HOLD = 10;

// How long each attractor is held before the cycle moves on.
const CYCLE_INTERVAL = 10;

// Long enough to read as a transformation rather than a cut. The burst is a
// half sine over this, so the cloud is at its most scattered halfway through.
const MORPH_DURATION = 2.4;

// The attractors are a fraction of the ship's size, so the camera has to come
// in with them or they render as a speck. This is the framing radius once the
// cloud is an attractor; it is measured off the settled cloud.
const ATTRACTOR_RADIUS = 4;

let current = 0;
let started = false;
let cycling = false;
let morphTween = null;
let cycleCall = null;
let holdCall = null;
const buttons = [];

export function currentAttractor() {
  return current;
}

// The ship comes apart into the first attractor. One way: there is no route
// back to state 0, by design, so this runs at most once.
export function startAttractorMode() {
  const sim = getSimMaterial();
  const rend = getRenderMaterial();

  // The buttons exist from first paint but the simulation is built behind the
  // GLB and the GPU tier probe, so this can be reached before there is
  // anything to drive.
  if (started || !sim || !rend) {
    return;
  }

  started = true;
  cycling = true;
  holdCall?.kill();

  sim.uniforms.state.value = 1;
  // From and to are the same attractor, so the burst does all the work: the
  // ship scatters and the first attractor gathers the pieces.
  sim.uniforms.attractorFrom.value = current;
  sim.uniforms.attractorTo.value = current;
  runMorph(sim);

  // framing follows the cloud down from the ship's bounding box to the
  // attractor's, the middle page scrub owns rig.fit only
  gsap.to(rig, { radius: ATTRACTOR_RADIUS, duration: MORPH_DURATION, ease: "power2.inOut" });
  gsap.to(rig.extent, { x: 1, y: 1, z: 1, duration: MORPH_DURATION, ease: "power2.inOut" });
  // The ship's sampled colours are meaningless once the shape is not a ship.
  gsap.to(rend.uniforms.colourMix, { value: 1, duration: MORPH_DURATION, ease: "none" });

  scheduleNext();
}

// Starts the clock that ends the ship. Called when the landing intro finishes,
// so the ship is fully formed before the countdown begins.
export function holdShipThenStart() {
  if (started) {
    return;
  }
  holdCall?.kill();
  holdCall = gsap.delayedCall(SHIP_HOLD, startAttractorMode);
}

export function switchAttractor(index) {
  const sim = getSimMaterial();

  if (!sim || index < 0 || index >= ATTRACTORS.length) {
    return;
  }

  // A press before the ship has come apart skips the wait rather than being
  // ignored, and lands on the attractor that was asked for.
  if (!started) {
    current = index;
    syncButtons();
    startAttractorMode();
    return;
  }

  if (index === current) {
    return;
  }

  const uniforms = sim.uniforms;

  // A press during a transition starts the new one from whichever field is
  // actually driving the cloud at that instant, which is the same test the
  // shader makes. Taking `current` instead would hand it the attractor the
  // particles are still on their way to but have not reached.
  uniforms.attractorFrom.value = uniforms.morph.value < 0.5
    ? uniforms.attractorFrom.value
    : uniforms.attractorTo.value;
  uniforms.attractorTo.value = index;

  current = index;
  syncButtons();
  runMorph(sim);
  scheduleNext();
}

// Pins the cloud to one attractor and stops the clock, for the project panel.
export function lockAttractor(index = PROJECT_ATTRACTOR) {
  switchAttractor(index);
  // Stopped afterwards, not before: reaching the panel without having seen the
  // landing morph starts attractor mode here, and that turns cycling on.
  cycling = false;
  cycleCall?.kill();
  cycleCall = null;
}

export function resumeCycle() {
  if (!started) {
    return;
  }
  cycling = true;
  scheduleNext();
}

function runMorph(sim) {
  morphTween?.kill();
  sim.uniforms.morph.value = 0;
  morphTween = gsap.to(sim.uniforms.morph, {
    value: 1,
    duration: MORPH_DURATION,
    ease: "none",
  });
}

function scheduleNext() {
  cycleCall?.kill();
  if (!cycling) {
    cycleCall = null;
    return;
  }
  cycleCall = gsap.delayedCall(CYCLE_INTERVAL, () => {
    switchAttractor((current + 1) % ATTRACTORS.length);
  });
}

function syncButtons() {
  buttons.forEach((button, index) => {
    button.setAttribute("aria-pressed", String(index === current));
  });
}

function initAttractorSwitch() {
  const list = document.querySelector(".attractor-switch");
  if (!list) {
    return;
  }

  ATTRACTORS.forEach((attractor, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "attractor-option";
    button.textContent = attractor.name;
    button.setAttribute("aria-pressed", String(index === current));
    button.addEventListener("click", () => switchAttractor(index));
    list.appendChild(button);
    buttons.push(button);
  });

  list.setAttribute("aria-label", "Attractor");
}

initAttractorSwitch();
