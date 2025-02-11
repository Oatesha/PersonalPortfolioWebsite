import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";
import { ScrollToPlugin } from "gsap/all";
// import Lenis from '@studio-freight/lenis'
import SplitType from 'split-type'
import { camera, getSimMaterial, getRenderMaterial, mobile } from "./threejsParticles";


gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

let simMaterial, rendMaterial;

// sections
const sectionsElements = document.querySelectorAll('[class*="Section"]');
const circle1 = document.querySelector('#circleOne');
const circle2 = document.querySelector('#circleTwo');
const circle3 = document.querySelector('#circleThree');

// split load text
new SplitType(".LoadingText");

//intro
const landingText = sectionsElements[1];
const introTextFirstLine = landingText.querySelector('h4');
const introTextThirdLine = landingText.querySelector('p');
const loadingAnimationTimeline = gsap.timeline();

window.onload = function() {
    initLoadingAnim();
};

function initLoadingAnim() {
    console.log("loading anim started");
    
    // animate chars moving up
    loadingAnimationTimeline.to(".char", {
        y: 0,
        stagger: 0.1,
        delay: 0.2,
        duration: 0.5,
        ease: "circ",
        onComplete: scrollDownSmoothly,
    });
    loadingAnimationTimeline.to(".LoadingText", {
        autoAlpha: 1,
    }, "<")
    
    // init svg anim
    const backgroundBlobTimeline = gsap.timeline({
        repeat: -1,
        yoyo: true,
        repeatDelay: 2,
    });
    InitBackgroundBlobAnimationTimeline(backgroundBlobTimeline);
}

export function initAnim() {

    // Init animation timeline
    simMaterial = getSimMaterial();
    rendMaterial = getRenderMaterial();
    InitLandingAnimationTimeline();
    InitMiddlePageAnimationTimeline();
}

function scrollDownSmoothly() {
    console.log("initanim oncomplete");
    gsap.to(window, {
        delay: 0.25,
        duration: 2.5, 
        scrollTo: { y: window.innerHeight }, 
        ease: "noneOut",
    });
}

function InitBackgroundBlobAnimationTimeline(timeline) {

    timeline.to(circle1, {
        duration: 4,
        y: "-=5vh",
        ease: "none",
    });
    timeline.to(circle2, {
        duration: 4,
        y: "+=5vh",
        ease: "none",
    }, "<");

    timeline.to(circle3, {
        duration: 6,
        x: "+= 10vw",
        scale: 1.5,
        ease: "none",
    }, "<");

    timeline.to(circle3, {
        duration: 6,
        y: "-=10vh",
        x: "+=4vw",
        scale: 1.0,
        ease: "none",
    });

    timeline.to(circle1, { 
        duration: 4,
        y: "+= 5vh",
        ease: "none",
    }, "<");

    timeline.to(circle2, { 
        duration: 4,
        y: "-=5vh",
        x: "+= 2.5vw",
        ease: "none",
    }, "<");

    timeline.to(circle2, {
        duration: 6,
        y: "-=12.5vh",
        scale: 1.5,
        zIndex: 2,
        ease: "none",
    })
    timeline.to(circle1, {
        duration: 3,
        y: "+=15vh",
        ease: "none",
    }, "<")
}

function InitLandingAnimationTimeline() {
    var introTl = gsap.timeline({
        scrollTrigger: {
            trigger: ".LandingPageSection",
            start: "-50px center",
        },
    });

    // Animate the text elements
    introTl.fromTo(introTextFirstLine, { opacity: 0, y: -50 }, { opacity: 1, y: 0, duration: 0.75, ease: "power1"});
    introTl.fromTo(camera.position, {z: -5}, {z: mobile ? 150 : 75, duration: 1.75});
    introTl.fromTo(simMaterial.uniforms.mixValue, {value: 0.0}, {value: 1.0, duration: 2.0}, "-=1.75");
    introTl.fromTo(introTextThirdLine, { opacity: 0, y: -50 }, { opacity: 1, y: 0, duration: 0.75, ease: "power3"});
}

function InitMiddlePageAnimationTimeline() {
    var middlePageTl = gsap.timeline({
        scrollTrigger: {
            trigger: ".LandingPageSection",
            start: "55% center",
            end: () => `+=${sectionsElements[1].getBoundingClientRect().height * 1.5}`,
            scrub: true,
        },
    });
    middlePageTl.to(camera.position, {x: "-=90"});
    middlePageTl.to(simMaterial.uniforms.state, {value: 1});
    middlePageTl.to(rendMaterial.uniforms.pointSize, {value: 0.5})
}

// slope and function for widths around 1920-3440 need to fix this to be responsive on all
export function animateParticlesIn() {
    const slope = 1/760;
    const yIntercept = 93;
    const idealX = (slope * innerWidth) + yIntercept;
    gsap.set(camera.position, {y: "-25", x: "+=" + (mobile ? "90" : idealX)})
    gsap.to(camera.position, {
        duration: 1.5,
        z: mobile ? "36" : "18",
        y: mobile ? "-10" : "-2.5",
    })
}

export function animateParticlesOut() {
    const slope = 1/760;
    const yIntercept = 93;
    const idealX = (slope * innerWidth) + yIntercept;
    gsap.to(camera.position, {
        duration: 1.5,
        x: "-=" + (mobile ? "90" : idealX),
        z: mobile ? "150" : "50",
    })
}