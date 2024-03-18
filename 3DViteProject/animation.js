import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";
import { ScrollToPlugin } from "gsap/all";
import Lenis from '@studio-freight/lenis'
import { camera } from "./threejsParticles";
import SplitType from 'split-type'
import { getSimMaterial } from "./threejsParticles";

// sections

let simMaterial;

gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);


const sectionsElements = document.querySelectorAll('[class*="Section"]');

// split load text
new SplitType(".LoadingText");

//intro
const landingText = sectionsElements[1];
const introTextFirstLine = landingText.querySelector('h4');
// const introTextSecondLine = landingText.querySelector('h1');
const introTextThirdLine = landingText.querySelector('p');


// window.addEventListener('scroll', () => {
//     let currentSection = '';
  
//     sections.forEach(section => {
//       const sectionTop = section.offsetTop;
//       const sectionHeight = section.clientHeight;
//       if (window.pageYOffset >= sectionTop - (sectionHeight / 3)) {
//         currentSection = section.getAttribute('id');
//       }
//     });
  
//     indicatorBoxes.forEach(box => {
//       box.classList.remove('active');
//       if (box.dataset.section === currentSection) {
//         box.classList.add('active');
//       }
//     });
//   });


const lenis = new Lenis({
    duration: 1.2,
    easeInOut: true,
    smooth: true, 
    lerp: 0.05,
});


function raf(time) {
    lenis.raf(time);
    requestAnimationFrame(raf);
}

requestAnimationFrame(raf);




window.onload = function() {
    
    initAnim();
    console.log("loaded");
};

function initAnim() {
    // Initialize your animation timeline
    simMaterial = getSimMaterial();
    InitAnimationTimeline();
    
        // Create a timeline for your animations
    const animationTimeline = gsap.timeline({
        delay: 1.5,
    });

    // Add animations to the animation timeline
    animationTimeline.to(".char", {
        y: 0,
        stagger: 0.1,
        delay: 0.2,
        duration: 0.5,
        ease: "circ",
    });
    animationTimeline.to(".LoadingText", {
        autoAlpha: 1,
        onComplete: scrollDownSmoothly,
    }, "<")

}

function scrollDownSmoothly() {
    console.log("initanim oncomplete");
    gsap.to(window, {
        delay: 0.25,
        duration: 2.5, 
        scrollTo: { y: window.innerHeight }, 
        ease: "power2.inOut",
    });
}

// Initialize Animation Timeline
function InitAnimationTimeline() {
    var introTl = gsap.timeline({
        scrollTrigger: {
            trigger: ".LandingPageSection",
            start: "-50px center",
            markers: true,
        },
    });

    // Animate the text elements
    introTl.fromTo(introTextFirstLine, { opacity: 0, y: -50 }, { opacity: 1, y: 0, duration: 0.75, ease: "power1"});
    introTl.fromTo(camera.position, {x: 0, z: -5}, {x: 0, z: 50, duration: 1.75});
    introTl.fromTo(simMaterial.uniforms.maxDist, {value: 1.0}, {value: 2.0, duration: 1.5});
    introTl.fromTo(introTextThirdLine, { opacity: 0, y: -50 }, { opacity: 1, y: 0, duration: 0.75, ease: "power3"});
}



// OG
// introTl.fromTo(introTextFirstLine, { opacity: 0, y: -50 }, { opacity: 1, y: 0, duration: 0.75, ease: "power1"});
// introTl.fromTo(introTextSecondLine, { opacity: 0, y: -50 }, { opacity: 1, y: 0, duration: 0.75, ease: "power2"});
// introTl.fromTo(introTextThirdLine, { opacity: 0, y: -50 }, { opacity: 1, y: 0, duration: 0.75, ease: "power3"}, "-=0.25");
// introTl.fromTo(camera.position, {x: 0, z: -5}, {x: 25, z: 50.5, duration: 1.75})
