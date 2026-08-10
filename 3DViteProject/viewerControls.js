import { gsap } from "gsap";
import {
  getRenderMaterial,
  getParticleTotal,
  getParticleSteps,
  getDefaultParticleCount,
  setParticleCount,
} from "./main.js";

// particle size and count controls at the top of the page. both sliders run
// over indices into a list of stops so every position is a value you can land
// on

const SIZE_INPUT = "#particleSizeInput";
const COUNT_INPUT = "#particleCountInput";

// gl_PointSize in pixels. coarse at the bottom where half a pixel is the
// difference between a haze and a solid
const SIZE_STEPS = [0.5, 1, 1.5, 2, 3, 4, 6, 8];

// the sim texture is sized in initFBO behind the gpu tier probe so the total is
// not known when the panel first paints
const READY_POLL = 0.25;

let sizeInput = null;
let countInput = null;
let sizeOutput = null;
let countOutput = null;
let countSteps = [];

// counts read as 65k and 1M rather than the full number
function abbreviate(count) {
  if (count >= 1000000) {
    const millions = count / 1000000;
    return `${Number.isInteger(millions) ? millions : millions.toFixed(1)}M`;
  }
  if (count >= 1000) {
    const thousands = count / 1000;
    return `${Number.isInteger(thousands) ? thousands : thousands.toFixed(1)}k`;
  }
  return String(count);
}

function formatSize(size) {
  return size.toFixed(1);
}

function applySize() {
  const material = getRenderMaterial();
  const size = SIZE_STEPS[Number(sizeInput.value)];
  sizeOutput.textContent = formatSize(size);
  if (material) {
    material.uniforms.pointSize.value = size;
  }
}

function applyCount() {
  if (!countSteps.length) {
    return;
  }
  const wanted = countSteps[Number(countInput.value)];
  countOutput.textContent = abbreviate(setParticleCount(wanted) || wanted);
}

// reserve the width of the longest label so the row holds still while you drag
function reserveWidth(output, labels) {
  const widest = labels.reduce((longest, label) => Math.max(longest, label.length), 1);
  output.style.minWidth = `${widest}ch`;
}

// the stops are not painted onto the track. the index makes the thumb land on
// one anyway and the datalist is filled in for screen readers
function buildSlider(input, listId, stops, format, startIndex) {
  input.min = 0;
  input.max = Math.max(0, stops.length - 1);
  input.step = 1;
  input.value = String(startIndex);

  const ticks = document.querySelector(listId);
  if (ticks) {
    ticks.replaceChildren(
      ...stops.map((stop, index) => {
        const option = document.createElement("option");
        option.value = String(index);
        option.label = format(stop);
        return option;
      }),
    );
  }

  return stops.map(format);
}

function nearestIndex(stops, wanted) {
  let nearest = 0;
  stops.forEach((stop, index) => {
    if (Math.abs(stop - wanted) < Math.abs(stops[nearest] - wanted)) {
      nearest = index;
    }
  });
  return nearest;
}

// polled off gsap's ticker rather than setTimeout so it stops with the tab
function waitForSimulation() {
  if (!getRenderMaterial() || !getParticleTotal()) {
    gsap.delayedCall(READY_POLL, waitForSimulation);
    return;
  }

  // the count's stops depend on the texture size so this slider is built here
  // rather than in the markup
  countSteps = getParticleSteps();
  reserveWidth(
    countOutput,
    buildSlider(
      countInput,
      "#particleCountTicks",
      countSteps,
      abbreviate,
      nearestIndex(countSteps, getDefaultParticleCount()),
    ),
  );

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

  // size depends on nothing the sim has to resolve so it is live from first
  // paint
  reserveWidth(
    sizeOutput,
    buildSlider(
      sizeInput,
      "#particleSizeTicks",
      SIZE_STEPS,
      formatSize,
      nearestIndex(SIZE_STEPS, 2),
    ),
  );

  sizeInput.addEventListener("input", applySize);
  countInput.addEventListener("input", applyCount);

  // deferred by a tick. main.js imports this module while still evaluating its
  // own top level so reaching back in synchronously hits renderMaterial in the
  // temporal dead zone
  gsap.delayedCall(0, waitForSimulation);
}

initViewerControls();
