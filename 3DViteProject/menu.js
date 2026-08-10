import { gsap } from "gsap";
import { Observer } from "gsap/all";
import { animateParticlesIn, animateParticlesOut } from "./animation";
import { invalidateRigRect } from "./cameraRig.js";
import { updateImageTexture } from "./main.js";
import { PROJECTS, MODEL_PROJECT } from "./content/projects.js";
import { renderProjects } from "./projects.js";

gsap.registerPlugin(Observer);

// which project the next press lands on and which panel holds the canvas
let nextProjectSection = 0;
let currentCanvasPointer = 0;

renderProjects();
initObservers();

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

// each arrow path carries a rotate() transform so this is the x gsap decomposes
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


let lastTween = null;

// how long the panels take to slide past each other and where in that the
// screenshot changes
const SLIDE_DURATION = 1.5;
const CANVAS_HANDOVER = 0.5;
const STATUS_SWITCH = 1.25;

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
