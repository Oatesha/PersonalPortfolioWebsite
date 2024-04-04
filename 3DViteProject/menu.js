import { gsap } from "gsap";
import { Observer } from "gsap/all";
import { imagecam } from "./threejsParticles";
import { Flip } from "gsap/all";

gsap.registerPlugin(Observer, Flip);


const hamburgerMenu = document.querySelector(".HamburgerToggle");
const menu = document.querySelector(".MenuElements");
const blurBackground = document.querySelector(".menuBlur");
const buttonSVGOne = document.querySelector("#buttonSVGOne");
const buttonSVGTwo = document.querySelector("#buttonSVGTwo");
let activeProjectSection = 0;
const projectSections = gsap.utils.toArray(`.project-section`);

console.log(document.querySelector(`[pos-index="1"]`));
console.log(buttonSVGOne);

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

// Handles project section button presses takes in an int of which button we are using
function projectButtonPress(button) {
    var targetButton = button == 1 ? buttonSVGOne : buttonSVGTwo;

    const state = Flip.getState('[pos-index="0"]');
    console.log(state);

    // Get the current and desired sections of the active project
    var currentDescriptionSection = document.querySelector('[status="active"').querySelector('.project-description-section');
    var currentTitleSection = document.querySelector('[status="active"').querySelector('.project-title-section');
    var currentNavSection = document.querySelector('[status="active"').querySelector('.project-nav-section');
    var desiredDescriptionSection = document.querySelector('[pos-index="1"').querySelector('.project-description-section');
    var desiredTitleSection = document.querySelector('[pos-index="1"').querySelector('.project-title-section');
    var desiredNavSection = document.querySelector('[pos-index="1"').querySelector('.project-nav-section');

    // Replace description, title, and nav sections of the active project with the next project's sections
    currentDescriptionSection.innerHTML = desiredDescriptionSection.innerHTML;
    currentTitleSection.innerHTML = desiredTitleSection.innerHTML;

    // // Update status attribute to switch active and inactive projects
    // currentProject.setAttribute('status', 'inactive');
    // nextProject.setAttribute('status', 'active');

    Flip.from(state, {
        absolute: true,
        duration: 5,
        ease: "power2.inOut",
    });


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
