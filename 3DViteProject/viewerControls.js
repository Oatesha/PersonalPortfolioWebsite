import { gsap } from "gsap";
import { getRenderMaterial, getParticleTotal, setParticleFraction } from "./main.js";

// particle size and count controls at the top of the page

const SIZE_INPUT = "#particleSizeInput";
const COUNT_INPUT = "#particleCountInput";

// The simulation texture is sized off the GPU tier, so the total is not known
// until initFBO has run. Everything here polls for it rather than being
// sequenced after it, because the panel is in the document from first paint.
const READY_POLL = 0.25;

let sizeInput = null;
let countInput = null;
let sizeOutput = null;
let countOutput = null;

const formatCount = new Intl.NumberFormat();

function applySize() {
  const material = getRenderMaterial();
  const value = Number(sizeInput.value);
  sizeOutput.textContent = value.toFixed(1);
  if (material) {
    material.uniforms.pointSize.value = value;
  }
}

function applyCount() {
  const fraction = Number(countInput.value) / 100;
  const drawn = setParticleFraction(fraction);
  const total = getParticleTotal();
  countOutput.textContent = total
    ? formatCount.format(drawn)
    : `${countInput.value}%`;
}

// Polled from gsap's ticker rather than a setTimeout, so this is on the same
// clock as everything else on the page and stops while the tab is hidden.
function waitForSimulation() {
  if (!getRenderMaterial() || !getParticleTotal()) {
    gsap.delayedCall(READY_POLL, waitForSimulation);
    return;
  }
  // Push the panel's own values through now that there is something to
  // receive them, so the sliders and the scene agree from the start.
  applySize();
  applyCount();
}

function initViewerControls() {
  sizeInput = document.querySelector(SIZE_INPUT);
  countInput = document.querySelector(COUNT_INPUT);

  if (!sizeInput || !countInput) {
    return;
  }

  sizeOutput = document.querySelector(`output[for="${sizeInput.id}"]`);
  countOutput = document.querySelector(`output[for="${countInput.id}"]`);

  sizeInput.addEventListener("input", applySize);
  countInput.addEventListener("input", applyCount);

  // deferred by a tick. main.js imports this module while still evaluating its
  // own top level, so reaching back into it synchronously hits renderMaterial
  // in the temporal dead zone
  gsap.delayedCall(0, waitForSimulation);
}

initViewerControls();
