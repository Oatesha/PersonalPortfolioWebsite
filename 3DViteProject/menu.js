import { gsap } from "gsap";
import { Observer } from "gsap/all";
import { animateParticlesIn, animateParticlesOut } from "./animation";
import { invalidateRigRect } from "./cameraRig.js";
import { updateImageTexture } from "./main.js";
import { Flip } from "gsap/all";

gsap.registerPlugin(Observer, Flip);


// const hamburgermenu = document.queryselector(".hamburgertoggle");
// const menu = document.queryselector(".menuelements");
// const blurbackground = document.queryselector(".menublur");

let nextProjectSection = 0;
let currentCanvasPointer = 0;

// fix the hamburgerMenu when i find a use for it
// hamburgerMenu.addEventListener("click", toggleMenu);
// hamburgerMenu.addEventListener("mouseenter", hoverHamburger);
// hamburgerMenu.addEventListener("mouseleave", exitHoverHamburger);

// buttonSVGOne.addEventListener("click", toggleMenu);
// buttonSVGOne.addEventListener("mouseenter", hoverHamburger);
// buttonSVGOne.addEventListener("mouseleave", exitHoverHamburger);

// buttonSVGTwo.addEventListener("click", toggleMenu);
// buttonSVGTwo.addEventListener("mouseenter", hoverHamburger);
// buttonSVGTwo.addEventListener("mouseleave", exitHoverHamburger);

// let menuVisible = false;
// let targetAlpha, targetZ;


// window.addEventListener('DOMContentLoaded', () => {
//   initObservers();
//   console.log("loaded");
// });

initObservers();

// function toggleMenu() {
//     menuVisible ? targetAlpha = 0.0 : targetAlpha = 1.0; 
//     menuVisible ? targetZ = 0.0 : targetZ = 5.0; 
//     menuVisible = !menuVisible;

//     gsap.to(menu, {
//         autoAlpha: targetAlpha,
//         duration: 0.5,
//     })
//     gsap.to(blurBackground, {
//         autoAlpha: targetAlpha,
//     })
// }

// function hoverHamburger() {
//     // console.log("hovered");
// }

// function exitHoverHamburger() {
//     // console.log("left");
// }



function initObservers() {
  const svgButtons = document.querySelectorAll('.project-nav-section svg');
  svgButtons.forEach(element => {
    
    var direction = element.id == "buttonSVGOne" ? true : false;
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
        // open link to github project
        if (link) {
          window.open(link);
        }},
    });
  });
}

// each arrow path carries a rotate() transform, so the x gsap decomposes out of
// it is 0.293 for one arrow and 18.121 for the other, not zero. remember it per
// element and always return to it
const restingX = new WeakMap();

// animate button on hover, both ends absolute so repeated hovers can't walk
// the arrow away
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

// how long the panels take to slide past each other, and where in that the
// screenshot changes hands. the canvas moves at the peak of the scatter, when
// there's nothing legible on it, so the handover is invisible
const SLIDE_DURATION = 1.5;
const CANVAS_HANDOVER = 0.5;
const STATUS_SWITCH = 1.25;

// Handles project section button presses takes in an int of which button we are using
function projectButtonPress(button) {

  // prevents pressing next section before the current one has animated in
  if (lastTween && lastTween.isActive()) {
    return;
  }

  const currentProject = document.querySelector('[status="active"]');

  var pointerIncrement = button.id == "buttonSVGOne" ? -1 : 1;

  nextProjectSection = (nextProjectSection + pointerIncrement) % 4;

  if (nextProjectSection < 0) {nextProjectSection += 4};

  const nextProject = document.querySelector(`[pos-index="${nextProjectSection}"]`);
  const currentCanvasElement = document.querySelector(`[pos-index="${currentCanvasPointer}"]`);

  if (currentProject.getAttribute("pos-index") == 1) {
    animateParticlesOut();
  }

  // a fresh timeline per press, so the isActive() gate above stays meaningful.
  // panels slide with a css transform, which moves the image box without
  // changing its size, so nothing else notices it move
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
    // on the press, so the screenshot is already in pieces by the time anything
    // moves. does nothing for the particle project, it has no screenshot
    .call(updateImageTexture, [nextProjectSection], 0)
    .call(handOverImageCanvas, [nextProject, currentCanvasElement], CANVAS_HANDOVER)
    .call(markProjectActive, [nextProject, currentProject, nextProjectSection], STATUS_SWITCH);
}

// moves the one screenshot canvas into the panel sliding in. there's only ever
// a single canvas since it's a webgl context, not a picture
function handOverImageCanvas(project, currentCanvasElement) {
  // the particle project's screenshot is the model itself, so the canvas stays
  // put and rides the outgoing panel off screen
  if (project.getAttribute("pos-index") == 1) {
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

  // no fade in, the canvas arrives scattered and reforms into the right image
  currentCanvasPointer = project.getAttribute("pos-index");
}

function markProjectActive(project, currentProject, nextProjectSection) {
  currentProject.setAttribute("status", "inactive");
  project.setAttribute("status", "active");

  if (nextProjectSection == 1) {
    animateParticlesIn();
  }
}
