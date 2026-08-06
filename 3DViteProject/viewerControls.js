import { gsap } from "gsap";
import {
  getRenderMaterial,
  getParticleTotal,
  getParticleSteps,
  getDefaultParticleCount,
  setParticleCount,
} from "./main.js";

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
let steps = [];

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
  if (!steps.length) {
    return;
  }
  const wanted = steps[Number(countInput.value)];
  countOutput.textContent = formatCount.format(setParticleCount(wanted) || wanted);
}

// The slider runs over indices into the step list rather than over particle
// counts, so every position is a stop and the graduations the browser draws
// from the datalist line up with the values you can actually land on. A
// continuous slider over 1..1,048,576 could not do either.
function buildCountSteps() {
  steps = getParticleSteps();

  countInput.min = 0;
  countInput.max = Math.max(0, steps.length - 1);
  countInput.step = 1;

  // Spacing of the graduations painted on the track. See the range rules in
  // style.css for why they are not the browser's own datalist ticks.
  const intervals = Math.max(1, steps.length - 1);
  countInput.style.setProperty("--tick-gap", `${100 / intervals}%`);

  const ticks = document.querySelector("#particleCountTicks");
  if (ticks) {
    ticks.replaceChildren(
      ...steps.map((count) => {
        const option = document.createElement("option");
        option.value = String(steps.indexOf(count));
        option.label = formatCount.format(count);
        return option;
      }),
    );
  }

  // Nearest step to the tier's suggestion, so the opening count is one the
  // slider can actually sit on.
  const wanted = getDefaultParticleCount();
  let nearest = 0;
  steps.forEach((count, index) => {
    if (Math.abs(count - wanted) < Math.abs(steps[nearest] - wanted)) {
      nearest = index;
    }
  });
  countInput.value = String(nearest);
}

// Polled from gsap's ticker rather than a setTimeout, so this is on the same
// clock as everything else on the page and stops while the tab is hidden.
function waitForSimulation() {
  if (!getRenderMaterial() || !getParticleTotal()) {
    gsap.delayedCall(READY_POLL, waitForSimulation);
    return;
  }
  // The step list depends on the texture size, which is only known once the
  // tier probe has resolved, so the count slider is built here rather than in
  // the markup.
  buildCountSteps();
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
