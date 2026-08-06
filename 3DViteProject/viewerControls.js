import { gsap } from "gsap";
import {
  getRenderMaterial,
  getParticleTotal,
  getParticleSteps,
  getDefaultParticleCount,
  setParticleCount,
} from "./main.js";

// particle size and count controls at the top of the page. both sliders run
// over indices into a list of stops rather than continuously, so every position
// is a value you can land on

const SIZE_INPUT = "#particleSizeInput";
const COUNT_INPUT = "#particleCountInput";

// gl_PointSize in pixels. coarse at the bottom where half a pixel is the
// difference between a haze and a solid, wider at the top where it isn't
const SIZE_STEPS = [0.5, 1, 1.5, 2, 3, 4, 6, 8];

// the sim texture is sized in initFBO behind the gpu tier probe, so the total
// isn't known up front and the panel is in the document from first paint
const READY_POLL = 0.25;

let sizeInput = null;
let countInput = null;
let sizeOutput = null;
let countOutput = null;
let countSteps = [];

// counts read as 65k and 1M rather than 65,536 and 1,048,576
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

// Widths are reserved for the longest label the control will ever show, so the
// panel holds still while you drag instead of growing and shrinking each time
// the number changes magnitude.
function reserveWidth(output, labels) {
  const widest = labels.reduce((longest, label) => Math.max(longest, label.length), 1);
  output.style.minWidth = `${widest}ch`;
}

// The graduations are painted onto the track from a repeating gradient whose
// period is set here, because Chrome only draws its own datalist ticks while
// the control keeps its native appearance and appearance: none is what lets the
// panel match the page. The datalist is still populated: it costs nothing and
// assistive tech reads it.
function buildSlider(input, listId, stops, format, startIndex) {
  input.min = 0;
  input.max = Math.max(0, stops.length - 1);
  input.step = 1;
  input.value = String(startIndex);

  const intervals = Math.max(1, stops.length - 1);
  input.style.setProperty("--tick-gap", `${100 / intervals}%`);

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

// polled off gsap's ticker rather than setTimeout so it's on the same clock as
// everything else and stops while the tab is hidden
function waitForSimulation() {
  if (!getRenderMaterial() || !getParticleTotal()) {
    gsap.delayedCall(READY_POLL, waitForSimulation);
    return;
  }

  // the count's stops depend on the texture size, only known once the tier
  // probe resolves, so build this slider here rather than in the markup
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

  // size doesn't depend on anything the sim has to resolve, so it's live from
  // first paint
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
  // own top level, so reaching back into it synchronously hits renderMaterial
  // in the temporal dead zone
  gsap.delayedCall(0, waitForSimulation);
}

initViewerControls();
