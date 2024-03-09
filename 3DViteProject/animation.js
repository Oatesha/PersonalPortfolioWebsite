import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";
import { ScrollToPlugin } from "gsap/all";
import Lenis from '@studio-freight/lenis'
import { camera } from "./threejsParticles";
import SplitType from 'split-type';

// sections

gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);


const sectionsElements = document.querySelectorAll('[class*="Section"]');

// split load text
new SplitType(".LoadingText");

//intro
const landingText = sectionsElements[1];
console.log(landingText);
const introTextFirstLine = landingText.querySelector('h4');
const introTextSecondLine = landingText.querySelector('h1');
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
});


function raf(time) {
    lenis.raf(time);
    requestAnimationFrame(raf);
}

requestAnimationFrame(raf);

const animationTimeline = gsap.timeline({
    onComplete: scrollDownSmoothly,
});

// window.addEventListener("load", function(event) {
//     initAnim();
// });

initAnim();
function initAnim() {
    animationTimeline.to(".char", {
    
        y: 0,
        stagger: 0.1,
        delay: 0.2,
        duration: 0.5,
        ease: "circ",
    });
    animationTimeline.to(".LoadingText", {
        autoAlpha: 1,
    }, "<")
}



function scrollDownSmoothly() {

    gsap.to(window, {
        delay: 0.5,
        duration: 1, // Duration of the scroll animation in seconds
        scrollTo: { y: window.innerHeight }, // Scroll down by one viewport height
        ease: "power2.inOut",

    });
}


var introTl = gsap.timeline({
});
// Animate the text elements
introTl.fromTo(introTextFirstLine, { opacity: 0, y: -50 }, { opacity: 1, y: 0, duration: 0.75, ease: "power1"});
introTl.fromTo(introTextSecondLine, { opacity: 0, y: -50 }, { opacity: 1, y: 0, duration: 0.75, ease: "power2"});
introTl.fromTo(introTextThirdLine, { opacity: 0, y: -50 }, { opacity: 1, y: 0, duration: 0.75, ease: "power3"}, "-=0.25");
introTl.fromTo(camera.position, {x: 0, z: -5}, {x: -3, z: 12.5, duration: 2})



