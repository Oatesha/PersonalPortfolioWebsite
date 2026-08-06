import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";
import { ScrollToPlugin } from "gsap/all";
import SplitType from 'split-type'
import Lenis from "lenis";
import { getSimMaterial } from "./main";
import { rig, setRigTarget } from "./cameraRig.js";
import { holdShipThenStart, startAttractorMode, lockAttractor, resumeCycle } from "./attractors.js";

gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

// driven from gsap's ticker rather than its own raf so scrolling, tweening and
// rendering all advance on one clock
export const lenis = new Lenis({ autoRaf: false });

lenis.on("scroll", ScrollTrigger.update);
gsap.ticker.add((time) => lenis.raf(time * 1000));
// lenis integrates its own delta, gsap's lag correction would fight it
gsap.ticker.lagSmoothing(0);

let simMaterial;
let cameraBobbingAnim;
let middlePageTl = null;
let middlePageTrigger = null;
// true while the project whose screenshot is the particle model is on screen
let particleProjectActive = false;

// fractions of the distance at which the model exactly fills its target box, so
// they read the same at every resolution. 1.0 fills the box, small negative
// values sit inside the cloud
const INSIDE_MODEL_FIT = -0.07;
const THROUGH_MODEL_FIT = -0.15;
const BOB_AMPLITUDE = 2;

// the ship coming apart and the cycle through the attractors both live in
// attractors.js, this module only decides when and owns rig.fit throughout

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

// this module sits behind an async import chain so load has sometimes already
// fired by the time it runs, and a window.onload assignment was dropped
if (document.readyState === "complete") {
    initLoadingAnim();
} else {
    window.addEventListener("load", initLoadingAnim, { once: true });
}

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
    // the middle page timeline is built from the landing timeline's onComplete.
    // both drive rig.fit, and a scrubbed trigger renders progress 0 every frame
    // it sits before its start, so only one of them can exist at a time
    InitLandingAnimationTimeline();
    InitCameraBobbing();
    // these are built after the GLB and the tier probe resolve, long after load,
    // so ScrollTrigger has already done its own refresh pass without them
    ScrollTrigger.refresh();
}

function scrollDownSmoothly() {
    // first input wins
    const userInput = ["wheel", "touchstart", "keydown", "pointerdown"];
    const release = () => userInput.forEach((type) => window.removeEventListener(type, stop));
    const stop = () => {
        // cancel the pending start and halt the run in progress where it is
        delayed.kill();
        lenis.scrollTo(lenis.animatedScroll, { immediate: true });
        release();
    };

    // through lenis rather than ScrollToPlugin so only one thing writes the
    // scroll position, and to the section rather than window.innerHeight
    const delayed = gsap.delayedCall(0.25, () => {
        lenis.scrollTo(".LandingPageSection", { duration: 2.5, onComplete: release });
    });

    userInput.forEach((type) => window.addEventListener(type, stop, { passive: true }));
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
        // hand rig.fit to the scrubbed timeline only once the fly-out is done,
        // so the two never own it at the same time
        onComplete: () => {
            InitMiddlePageAnimationTimeline();
            ScrollTrigger.refresh();
            // countdown starts here rather than at load so the ship is fully
            // assembled for the whole hold
            holdShipThenStart();
        },
    });

    // Animate the text elements
    introTl.fromTo(introTextFirstLine, { opacity: 0, y: -50 }, { opacity: 1, y: 0, duration: 0.75, ease: "power1"});
    // pull out from inside the model until it exactly fills its box
    introTl.fromTo(rig, { fit: INSIDE_MODEL_FIT }, { fit: 1.0, duration: 1.75 });
    introTl.fromTo(simMaterial.uniforms.mixValue, {value: 0.0}, {value: 1.0, duration: 2.0}, "-=1.75");
    introTl.fromTo(introTextThirdLine, { opacity: 0, y: -50 }, { opacity: 1, y: 0, duration: 0.75, ease: "power3"});
}

// distance from this timeline's start to where the project section takes the
// camera off it, so the two points coincide at any aspect ratio
function middlePageScrubLength() {
    const landing = sectionsElements[1];
    const project = document.querySelector(".ProjectSection");
    // mirrors the two trigger positions, this one starts at the landing's 55%
    // mark and the project one at its own top, both against the viewport centre
    return project.offsetTop - landing.offsetTop - landing.offsetHeight * 0.55;
}

function InitMiddlePageAnimationTimeline() {
    middlePageTl = gsap.timeline({
        scrollTrigger: {
            trigger: ".LandingPageSection",
            start: "55% center",
            end: () => `+=${middlePageScrubLength()}`,
            // a number, not true. scrub true locks the timeline to the scroll
            // position exactly so every stutter shows up in the camera
            scrub: 0.6,
            onEnter: () => {
                cameraBobbingAnim.pause();
                // whichever of this and the ship hold comes first wins,
                // startAttractorMode only runs once
                startAttractorMode();
            },
            onLeaveBack: () => cameraBobbingAnim.resume(),
        },
    });
    // owns rig.fit and nothing else. the radius, extents, state flip and
    // colours belong to attractors.js, which can be driven by a timer and so
    // can't be scrubbed against scroll position
    middlePageTl.to(rig, { fit: THROUGH_MODEL_FIT, duration: 1.0 });

    middlePageTrigger = middlePageTl.scrollTrigger;
    InitProjectContextTrigger();
}

// past its end a scrubbed timeline reasserts its final value on every update,
// so ownership of the camera is handed over explicitly
function InitProjectContextTrigger() {
    ScrollTrigger.create({
        trigger: ".ProjectSection",
        start: "top center",
        onEnter: () => {
            // land on the end values before freezing, the scrub lags the scroll
            // so the timeline is still short of its end here. finish the scrub
            // tween and not the timeline, writing progress on the timeline
            // desyncs ScrollTrigger and it stops driving it back on the way up
            middlePageTrigger.getTween()?.progress(1);
            middlePageTrigger.disable(false);
            if (particleProjectActive) {
                frameParticleProject();
            }
        },
        onLeaveBack: () => {
            setRigTarget(document.querySelector('.LandingStage'));
            middlePageTrigger.enable();
        },
    });
}

function frameParticleProject() {
    setRigTarget(document.querySelector('project[pos-index="1"] .project-image-section'));
    gsap.to(rig, { fit: 1.0, duration: 1.0, overwrite: "auto" });
}

function InitCameraBobbing() {
    cameraBobbingAnim = gsap.timeline({ paused: true, repeat: -1, yoyo: true });
    // absolute, not relative. a "+=2" tween captures its start value once so it
    // snapped whenever anything else wrote to the camera's y
    cameraBobbingAnim.to(rig, { bobY: BOB_AMPLITUDE, duration: 3, ease: "sine.inOut" });
    cameraBobbingAnim.play();
}

// the particle project has no screenshot, the model itself is the image. frame
// it into that project's image box and pin the attractor, so the panel is the
// same image every time
export function animateParticlesIn() {
    particleProjectActive = true;
    frameParticleProject();
    lockAttractor();
}

export function animateParticlesOut() {
    particleProjectActive = false;
    gsap.to(rig, { fit: THROUGH_MODEL_FIT, duration: 0.5, overwrite: "auto" });
    resumeCycle();
}
