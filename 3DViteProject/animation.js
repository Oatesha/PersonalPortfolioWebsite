import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";
import { ScrollToPlugin } from "gsap/all";
import SplitType from 'split-type'
import { getSimMaterial, getRenderMaterial } from "./main";
import { rig } from "./cameraRig.js";

gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

if (import.meta.env.DEV) {
    window.__ST = ScrollTrigger;
    window.__gsap = gsap;
}

let simMaterial, rendMaterial;
let cameraBobbingAnim;

// Camera framing is expressed as a fraction of the distance at which the model
// exactly fills its target box, so these read the same at every resolution.
// 1.0 fills the box; small negative values sit inside the particle cloud.
const INSIDE_MODEL_FIT = -0.07;
const THROUGH_MODEL_FIT = -0.15;
const BOB_AMPLITUDE = 2;

// sections
const sectionsElements = document.querySelectorAll('[class*="Section"]');
const circle1 = document.querySelector('#circleOne');
const circle2 = document.querySelector('#circleTwo');
const circle3 = document.querySelector('#circleThree');

// split load text
new SplitType(".LoadingText");
new SplitType(".MyName")

//intro
const landingText = sectionsElements[1];
const introTextFirstLine = landingText.querySelector('h4');
const introTextThirdLine = landingText.querySelector('p');
const loadingAnimationTimeline = gsap.timeline();

window.onload = function() {
    initLoadingAnim();
};

function initLoadingAnim() {
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
    // The middle page timeline is built by the landing timeline's onComplete.
    // Both drive rig.fit, and a scrubbed ScrollTrigger renders progress 0 on
    // every frame it sits before its start, so building them together let the
    // scrub overwrite the intro's fly-out each frame and pin the camera.
    InitLandingAnimationTimeline();
    InitCameraBobbing();
    // These triggers are built after the GLB and the GPU tier probe have
    // resolved, long after load, so ScrollTrigger has already done its own
    // refresh pass and left them with an unmeasured start and end.
    ScrollTrigger.refresh();
}

function scrollDownSmoothly() {
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
        // Hand rig.fit over to the scroll-scrubbed timeline only once the
        // fly-out has finished, so the two never own it at the same time.
        onComplete: () => {
            InitMiddlePageAnimationTimeline();
            ScrollTrigger.refresh();
        },
    });

    // Animate the text elements
    introTl.fromTo(introTextFirstLine, { opacity: 0, y: -50 }, { opacity: 1, y: 0, duration: 0.75, ease: "power1"});
    // Pull out from inside the model until it exactly fills its box.
    introTl.fromTo(rig, { fit: INSIDE_MODEL_FIT }, { fit: 1.0, duration: 1.75 });
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
            onEnter: () => cameraBobbingAnim.pause(),
            onLeaveBack: () => cameraBobbingAnim.resume(),
        },
    });
    middlePageTl.to(rig, { fit: THROUGH_MODEL_FIT, duration: 1.0 });
    middlePageTl.to(simMaterial.uniforms.state, {value: 1});
    middlePageTl.to(rendMaterial.uniforms.pointSize, {value: 0.5});
}

function InitCameraBobbing() {
    cameraBobbingAnim = gsap.timeline({ paused: true, repeat: -1, yoyo: true });
    // Absolute, not relative. A "+=2" tween captures its start value once, so it
    // snapped whenever anything else wrote to the camera's y position.
    cameraBobbingAnim.to(rig, { bobY: BOB_AMPLITUDE, duration: 3, ease: "sine.inOut" });
    cameraBobbingAnim.play();
}

export function animateParticlesIn() {
    gsap.to(rig, { fit: 1.0, duration: 1.0 });
}

export function animateParticlesOut() {
    gsap.to(rig, { fit: THROUGH_MODEL_FIT, duration: 0.5 });
}
