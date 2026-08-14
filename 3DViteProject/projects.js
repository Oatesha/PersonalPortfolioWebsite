import { gsap } from "gsap";
import { Observer } from "gsap/all";
import { animateParticlesIn, animateParticlesOut } from "./animation.js";
import { invalidateRigRect } from "./cameraRig.js";
import { updateImageTexture } from "./main.js";
import { PROJECTS, MODEL_PROJECT } from "./content.js";

gsap.registerPlugin(Observer);

const GITHUB_PATH =
  "M15,3C8.373,3,3,8.373,3,15c0,5.623,3.872,10.328,9.092,11.63C12.036,26.468,12,26.28,12,26.047v-2.051 c-0.487,0-1.303,0-1.508,0c-0.821,0-1.551-0.353-1.905-1.009c-0.393-0.729-0.461-1.844-1.435-2.526 c-0.289-0.227-0.069-0.486,0.264-0.451c0.615,0.174,1.125,0.596,1.605,1.222c0.478,0.627,0.703,0.769,1.596,0.769 c0.433,0,1.081-0.025,1.691-0.121c0.328-0.833,0.895-1.6,1.588-1.962c-3.996-0.411-5.903-2.399-5.903-5.098 c0-1.162,0.495-2.286,1.336-3.233C9.053,10.647,8.706,8.73,9.435,8c1.798,0,2.885,1.166,3.146,1.481C13.477,9.174,14.461,9,15.495,9 c1.036,0,2.024,0.174,2.922,0.483C18.675,9.17,19.763,8,21.565,8c0.732,0.731,0.381,2.656,0.102,3.594 c0.836,0.945,1.328,2.066,1.328,3.226c0,2.697-1.904,4.684-5.894,5.097C18.199,20.49,19,22.1,19,23.313v2.734 c0,0.104-0.023,0.179-0.035,0.268C23.641,24.676,27,20.236,27,15C27,8.373,21.627,3,15,3z";

const ARROW_PATH =
  "M3.293 18.293 4.707 19.707 12 12.414 19.293 19.707 20.707 18.293 12 9.586 3.293 18.293ZM12 6.414 20.293 14.293 21.707 12.879 12 3.586 3.293 12.293 4.707 13.707 12 6.414Z";

// how long the panels take to slide past each other, and where in that the
// screenshot changes
const SLIDE_DURATION = 1.5;
const CANVAS_HANDOVER = 0.5;
const STATUS_SWITCH = 1.25;

// which project the next press lands on, and which panel holds the canvas
let nextProjectSection = 0;
let currentCanvasPointer = 0;
let lastTween = null;

export function initProjects() {
  const section = document.querySelector(".ProjectSection");

  if (!section) {
    return;
  }

  section.innerHTML = PROJECTS.map(panel).join("");
  initObservers();
}

function escapeHtml(text) {
  return text.replace(/[&<>"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
  })[character]);
}

// the two arrows differ only in which way the chevron points
function navArrow(direction, rotation) {
  return `
    <svg data-nav="${direction}" width="200" height="150" viewBox="-12.5 -12.5 50 50" xmlns="http://www.w3.org/2000/svg">
      <path d="${ARROW_PATH}" transform="rotate(${rotation}, 12.5, 12.5)" fill="currentColor"/>
    </svg>`;
}

function panel(project, index) {
  return `
    <project pos-index="${index}" status="${index === 0 ? "active" : "inactive"}">
      <div class="project-image-section project-section"></div>
      <div class="project-description-section project-section">
        <p>${escapeHtml(project.blurb)}</p>
      </div>
      <div class="project-title-section project-section">
        <h2>${escapeHtml(project.title)}</h2>
        <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 30 30"
             role="link" tabindex="0" aria-label="${escapeHtml(project.title)} on GitHub"
             data-link="${escapeHtml(project.repo)}">
          <path d="${GITHUB_PATH}" fill="currentColor"/>
        </svg>
      </div>
      <div class="project-nav-section project-section">
        ${navArrow("prev", -90)}
        ${navArrow("next", 90)}
      </div>
    </project>`;
}

function initObservers() {
  const svgButtons = document.querySelectorAll('.project-nav-section svg');
  svgButtons.forEach(element => {

    var direction = element.dataset.nav == "prev";
    Observer.create({
      type: "pointer",
      target: element,
      onHover: () => projectButtonHover(true, element, direction),
      onHoverEnd: () =>  projectButtonHover(false, element, direction),
      onPress: () =>  projectButtonPress(element),
    });
  });

  const gitButtons = document.querySelectorAll('.project-title-section svg')
  gitButtons.forEach(element => {
    const link = element.dataset.link;
    Observer.create({
      type: "pointer",
      target: element,
      onHover: () => githubButtonHover(true, element),
      onHoverEnd: () =>  githubButtonHover(false, element),
      onPress: () => {
        if (link) {
          window.open(link);
        }},
    });
  });
}

// each arrow path carries a rotate() transform, so this is the x gsap decomposes
const restingX = new WeakMap();

// both ends absolute so repeated hovers cannot walk the arrow away
function projectButtonHover (state, button, direction) {
  var targetButton = button.querySelector('path');

  if (!restingX.has(targetButton)) {
    restingX.set(targetButton, gsap.getProperty(targetButton, "x"));
  }

  var rest = restingX.get(targetButton);
  var nudge = targetButton.getBBox().width * 0.2 * (direction ? -1 : 1);

  gsap.to(targetButton, {
    x: state ? rest + nudge : rest,
    duration: 0.3,
    ease: "back.out(2)",
    overwrite: "auto",
  });
}

function githubButtonHover (state, button) {
  var targetButton = button

  if (state) {
      gsap.to(targetButton, { scale: 1.25, duration: 0.3, ease: "back.out(4)" });
    } else {
      gsap.to(targetButton, { scale: 1, duration: 0.3, ease: "back.out(4)" });
    }
}

function projectButtonPress(button) {

  if (lastTween && lastTween.isActive()) {
    return;
  }

  const currentProject = document.querySelector('[status="active"]');

  var pointerIncrement = button.dataset.nav == "prev" ? -1 : 1;

  nextProjectSection = (nextProjectSection + pointerIncrement) % PROJECTS.length;

  if (nextProjectSection < 0) {nextProjectSection += PROJECTS.length};

  const nextProject = document.querySelector(`[pos-index="${nextProjectSection}"]`);
  const currentCanvasElement = document.querySelector(`[pos-index="${currentCanvasPointer}"]`);

  if (currentProject.getAttribute("pos-index") == MODEL_PROJECT) {
    animateParticlesOut();
  }

  // a fresh timeline per press so the isActive() gate above stays meaningful
  lastTween = gsap.timeline({ onUpdate: invalidateRigRect });

  lastTween
    .to(currentProject, {
      duration: SLIDE_DURATION,
      x: pointerIncrement == 1 ? '-100%' : '100%',
      ease: "power3.out",
    }, 0)
    .fromTo(nextProject,
      { x: pointerIncrement == 1 ? '100%' : '-100%', opacity: "0" },
      { duration: SLIDE_DURATION, opacity: "1", x: '0%', ease: "power3.out" },
      0)
    // on the press so the screenshot is in pieces before anything moves
    .call(updateImageTexture, [nextProjectSection], 0)
    .call(handOverImageCanvas, [nextProject, currentCanvasElement], CANVAS_HANDOVER)
    .call(markProjectActive, [nextProject, currentProject, nextProjectSection], STATUS_SWITCH);
}

// moves the one screenshot canvas into the panel sliding in
function handOverImageCanvas(project, currentCanvasElement) {
  if (project.getAttribute("pos-index") == MODEL_PROJECT) {
    return;
  }

  const canvas = currentCanvasElement.children[0].children[0];

  if (!canvas) {
    return;
  }

  const box = project.children[0];

  if (box.children[0]) {
    box.children[0].replaceWith(canvas);
  } else {
    box.appendChild(canvas);
  }

  // no fade in. the canvas arrives scattered and reforms
  currentCanvasPointer = project.getAttribute("pos-index");
}

function markProjectActive(project, currentProject, nextProjectSection) {
  currentProject.setAttribute("status", "inactive");
  project.setAttribute("status", "active");

  if (nextProjectSection == MODEL_PROJECT) {
    animateParticlesIn();
  }
}
