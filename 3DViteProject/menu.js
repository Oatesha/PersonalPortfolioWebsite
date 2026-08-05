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

  lastTween.to(currentProject, { duration: 1.5, x: pointerIncrement == 1 ? '-100%' : '100%', ease: "power3.out"})
  .call(switchImageCanvasSection, [nextProject, currentCanvasElement, currentProject, nextProjectSection], "<1.25")
  .fromTo(nextProject, { x: pointerIncrement == 1 ? '100%' : '-100%', opacity: "0" }, { duration: 1.5, opacity: "1", x: '0%', ease: "power3.out" }, "<-1.25");
}

// hacky but works should revisit later and make this functionality way more elegant
function switchImageCanvasSection(project, currentCanvasElement, currentProject, nextProjectSection) {
  
  currentProject.setAttribute("status", "inactive");
  project.setAttribute("status", "active");
  
  if (nextProjectSection == 1) {
    animateParticlesIn();
    return;
  }
  
  const currentCanvasNode = currentCanvasElement.children[0].children[0];
  
  gsap.set(currentCanvasNode, {opacity: 0});

  if (project.children[0].children[0]) {
    project.children[0].children[0].replaceWith(currentCanvasNode);

  } 
  
  else {
    project.children[0].appendChild(currentCanvasNode);

  }

  gsap.to(currentCanvasNode, { opacity: 1, duration: 0.25});

  currentCanvasPointer = project.getAttribute("pos-index");
  updateImageTexture(nextProjectSection);

}
