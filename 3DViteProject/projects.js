import { animateParticlesIn, animateParticlesOut } from "./animation.js";
import { mobile } from "./main.js";
import { showMark, clearMark, lockAttractor } from "./attractors.js";
import { buildMark } from "./markTargets.js";
import { PROJECTS, MODEL_PROJECT } from "./content.js";

// every project sits in a corner at once. the centre stage holds one of them

const ESCAPES = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
};

function escapeHtml(text) {
  return text.replace(/[&<>"]/g, (character) => ESCAPES[character]);
}

let selected = 0;
let corners = [];
let stage = null;
let shot = null;
// building a mark is async, so only the newest pick reaches the cloud
let pickToken = 0;
// the corners have no cloud to hand a picture to until the route is on screen
let routed = false;

export function initProjects() {
  const section = document.querySelector(".ProjectSection");

  if (!section) {
    return;
  }

  // a phone keeps the screenshots. a desktop shows them in the cloud, so the
  // stage is an empty box the rig frames into
  section.innerHTML = `
    <div class="ProjectStage" aria-hidden="true">${mobile ? '<img class="ProjectShot" alt="">' : ""}</div>
    <ul class="ProjectCorners">${PROJECTS.map(corner).join("")}</ul>`;

  stage = section.querySelector(".ProjectStage");
  shot = section.querySelector(".ProjectShot");
  corners = [...section.querySelectorAll(".ProjectCorner")];
  corners.forEach((item, index) => {
    item.querySelector(".ProjectPick").addEventListener("click", () => select(index));
  });

  paint();
}

function corner(project, index) {
  return `
    <li class="ProjectCorner" data-project="${index}">
      <button class="ProjectPick" type="button" aria-pressed="false">
        <span class="ProjectName">${escapeHtml(project.title)}</span>
      </button>
      <div class="ProjectDetail">
        <p class="ProjectBlurb">${escapeHtml(project.blurb)}</p>
        <a class="ProjectRepo Label" href="${escapeHtml(project.repo)}" target="_blank" rel="noreferrer">Repository &#8599;</a>
      </div>
    </li>`;
}

function paint() {
  const { shotMobile } = PROJECTS[selected];

  stage.classList.toggle("is-model", selected === MODEL_PROJECT);

  // the cloud project has no screenshot, and the class above hides the stage on
  // it, so the last one stays loaded underneath
  if (shot && shotMobile) {
    shot.src = shotMobile;
  }

  corners.forEach((item, index) => {
    const active = index === selected;
    item.classList.toggle("is-active", active);
    item.querySelector(".ProjectPick").setAttribute("aria-pressed", String(active));
  });
}

// the picture is the cloud itself, so it only runs while the route is on screen
export function enterProjects() {
  routed = true;
  show();
}

export function leaveProjects() {
  if (!routed) {
    return;
  }

  routed = false;
  pickToken++;
  clearMark();
}

function select(index) {
  if (index === selected) {
    return;
  }

  selected = index;
  paint();
  show();
}

async function show() {
  if (!routed) {
    return;
  }

  const isModel = selected === MODEL_PROJECT;

  // on a phone the screenshot is the panel, so the cloud stays a backdrop
  // behind it and only comes forward for the cloud project
  if (mobile) {
    if (isModel) {
      animateParticlesIn();
    } else {
      animateParticlesOut();
    }
    return;
  }

  const token = ++pickToken;

  if (isModel) {
    lockAttractor();
    return;
  }

  const mark = await buildMark(PROJECTS[selected].shot);

  if (mark && token === pickToken) {
    showMark(mark.texture, mark.framing);
  }
}
