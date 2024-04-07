import { gsap } from "gsap";
import { Observer } from "gsap/all";
import { imagecam } from "./threejsParticles";
import { Flip } from "gsap/all";
import SplitType from 'split-type'
import ScrambleText from 'scramble-text';

gsap.registerPlugin(Observer, Flip, ScrambleText);


const hamburgerMenu = document.querySelector(".HamburgerToggle");
const menu = document.querySelector(".MenuElements");
const blurBackground = document.querySelector(".menuBlur");
const buttonSVGOne = document.querySelector("#buttonSVGOne");
const buttonSVGTwo = document.querySelector("#buttonSVGTwo");
const projectSections = gsap.utils.toArray(`.project-section`);

let activeProjectSection = 0;


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

Observer.create({
    type: "pointer",
    target: buttonSVGOne,
    onHover: () => projectButtonHover(true),
    onHoverEnd: () =>  projectButtonHover(false),
    onPress: () =>  projectButtonPress(1),
});

Observer.create({
    type: "pointer",
    target: buttonSVGTwo,
    onHover: () => projectButtonHover(true),
    onHoverEnd: () =>  projectButtonHover(false),
    onPress: () =>  projectButtonPress(2),
})

// animate button on hover state true for entering hover false for exiting
function projectButtonHover (state) {
    if (state) {
        // Enter hover state
        gsap.to(buttonSVGOne, { scale: 1.2, duration: 0.3, ease: "back" });
      } else {
        // Exit hover state
        gsap.to(buttonSVGOne, { scale: 1, duration: 0.3, ease: "back" });
      }
}

const projectData = [
    {
      title: "Minecraftle",
      description: "Minecraftle is a wordle like clone based around minecraft where users have to guess the daily recipe."
    },
    {
      title: "Project 2",
      description: "This is the description for Project 2."
    }
  ];


// Handles project section button presses takes in an int of which button we are using
function projectButtonPress(button) {
    var targetButton = button == 1 ? buttonSVGOne : buttonSVGTwo;
  
    const projectTitleSection = document.querySelector('[pos-index="0"] .project-title-section.project-section');
    const projectImageSection = document.querySelector('[pos-index="0"] .project-image-section.project-section');
    const projectDescriptionSection = document.querySelector('[pos-index="0"] .project-description-section.project-section');
    
    const nextIndex = (activeProjectSection + 1) % projectData.length;
    activeProjectSection += 1;
  
    const newProjTl = gsap.timeline();
  
    newProjTl
      .to(projectTitleSection, { duration: 0.5, x: '-100%', stagger: 0.1 })
      .to(projectTitleSection, { duration: 0.5, x: '100%', stagger: 0.1 })
      .call(() => {
        console.log(projectTitleSection.childNodes[1]);
        projectTitleSection.childNodes[1].innerHTML = projectData[nextIndex].title;
        projectDescriptionSection.childNodes[1].innerHTML = projectData[nextIndex].description;
      })
      .to([projectTitleSection, projectImageSection, projectDescriptionSection], { duration: 0.5, x: 0, stagger: 0.1 });



    // gsap.to(activeProjectSection, {
    //     duration: 0.5,
    //     x: '-100%',
    //     opacity: 0,
    //     ease: 'power2.inOut',
    //     onComplete: () => {
    //       // Animate in the new project content
    //       gsap.fromTo(
    //         document.querySelector(`[pos-index="1"]`),
    //         {
    //           x: '100%',
    //           opacity: 0,
    //         },
    //         {
    //           duration: 0.5,
    //           x: '0%',
    //           opacity: 1,
    //           ease: 'power2.inOut',
    //         }
    //       );
    //     },
    //   });
}
