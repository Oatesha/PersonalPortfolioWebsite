import { gsap } from "gsap";
import { Observer } from "gsap/all";
import { animateParticlesIn } from "./animation";
import { imagecam, updateImageTexture } from "./threejsParticles";
import { Flip } from "gsap/all";
import SplitType from 'split-type'

gsap.registerPlugin(Observer, Flip);


const hamburgerMenu = document.querySelector(".HamburgerToggle");
const menu = document.querySelector(".MenuElements");
const blurBackground = document.querySelector(".menuBlur");
const buttonSVGOne = document.querySelector("#buttonSVGOne");
const buttonSVGTwo = document.querySelector("#buttonSVGTwo");
const projectSections = gsap.utils.toArray(`.project-section`);

let nextProjectSection = 0;
let currentCanvasPointer = 0;


hamburgerMenu.addEventListener("click", toggleMenu);
hamburgerMenu.addEventListener("mouseenter", hoverHamburger);
hamburgerMenu.addEventListener("mouseleave", exitHoverHamburger);

// buttonSVGOne.addEventListener("click", toggleMenu);
// buttonSVGOne.addEventListener("mouseenter", hoverHamburger);
// buttonSVGOne.addEventListener("mouseleave", exitHoverHamburger);

// buttonSVGTwo.addEventListener("click", toggleMenu);
// buttonSVGTwo.addEventListener("mouseenter", hoverHamburger);
// buttonSVGTwo.addEventListener("mouseleave", exitHoverHamburger);

let menuVisible = false;
let targetAlpha, targetZ;


// window.addEventListener('DOMContentLoaded', () => {
//   initObservers();
//   console.log("loaded");
// });

initObservers();

function toggleMenu() {
    menuVisible ? targetAlpha = 0.0 : targetAlpha = 1.0; 
    menuVisible ? targetZ = 0.0 : targetZ = 5.0; 
    menuVisible = !menuVisible;

    gsap.to(menu, {
        autoAlpha: targetAlpha,
        duration: 0.5,
    })
    gsap.to(blurBackground, {
        autoAlpha: targetAlpha,
    })
}

function hoverHamburger() {
    console.log("hovered");
}

function exitHoverHamburger() {
    console.log("left");
}



function initObservers() {
  const svgButtons = document.querySelectorAll('.project-nav-section svg');
  svgButtons.forEach(element => {

    Observer.create({
      type: "pointer",
      target: element,
      onHover: () => projectButtonHover(true, element),
      onHoverEnd: () =>  projectButtonHover(false, element),
      onPress: () =>  projectButtonPress(element),
    });
  });
}

// animate button on hover state true for entering hover false for exiting
function projectButtonHover (state, button) {
  // console.log(button)
  var targetButton = button;

  if (state) {
      // Enter hover state
      gsap.to(targetButton, { scale: 1.2, duration: 0.3, ease: "back" });
    } else {
      // Exit hover state
      gsap.to(targetButton, { scale: 1, duration: 0.3, ease: "back" });
    }
}


// Handles project section button presses takes in an int of which button we are using
function projectButtonPress(button) {

  const currentProject = document.querySelector('[status="active"]');

  var pointerIncrement = button.id == "buttonSVGOne" ? 1 : -1;

  nextProjectSection = (nextProjectSection + pointerIncrement) % 3;

  if (nextProjectSection < 0) {nextProjectSection += 3};

  

  const nextProject = document.querySelector(`[pos-index="${nextProjectSection}"]`);


  const newProjTl = gsap.timeline();
  // console.log(currentProject.childNodes[1]);
  // Get the Three.js canvas element from the current project
  const currentCanvasElement = document.querySelector(`[pos-index="${currentCanvasPointer}"]`);
  // console.log(currentCanvasElement);
  // console.log(nextProject);

  newProjTl
    .to(currentProject, { duration: 1.5, x: pointerIncrement == 1 ? '-100%' : '100%', ease: "power3.out"})
    .call(switchImageCanvasSection, [nextProject, currentCanvasElement, currentProject, nextProjectSection], "<1.25")
    .fromTo(nextProject, { x: pointerIncrement == 1 ? '100%' : '-100%', opacity: "0" }, { duration: 1.5, opacity: "1", x: '0%', ease: "power3.out" }, "<-1.25");


}

// hacky but works
function switchImageCanvasSection(project, currentCanvasElement, currentProject, nextProjectSection) {

  currentProject.setAttribute("status", "inactive");
  project.setAttribute("status", "active");

  if (nextProjectSection == 1) {
    animateParticlesIn();
    return;
  }

  // Get the canvas element from the current project
  console.log(currentCanvasElement.children[0].children)
  const currentCanvasNode = currentCanvasElement.children[0].children[0];
  // Check if the next project already has a canvas element
  if (project.children[0].children[0]) {
    // If it does, replace the existing canvas element
    project.children[0].children[0].replaceWith(currentCanvasNode);
  } else {
    // If it doesn't, append the current canvas element
    project.children[0].appendChild(currentCanvasNode);
  }

  // const currentCanvas = currentCanvasElement.querySelector('canvas');
  // project.childNodes[1].appendChild(currentCanvasElement.childNodes[1].firstChild);
  currentCanvasPointer = project.getAttribute("pos-index");
  console.log(currentCanvasPointer + " currcanvaspointer");
  console.log(currentCanvasElement);
  
  // console.log(currentProject.childNodes[1]);
  // currentProject.childNodes[1].appendChild(imageElement);

  // currentProject.childNodes[1].replaceWith(imageElement);
  updateImageTexture(nextProjectSection);


}
