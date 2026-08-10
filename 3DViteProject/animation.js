import { gsap } from "gsap";
import SplitType from 'split-type'
import Lenis from "lenis";
import { rig, setRigTarget } from "./cameraRig.js";
import { holdShipThenStart, startAttractorMode, lockAttractor, resumeCycle } from "./attractors.js";
import { MODEL_PROJECT } from "./content/projects.js";
import { leaveWork } from "./work.js";

// on gsap's ticker so everything shares one clock
export const lenis = new Lenis({ autoRaf: false });

gsap.ticker.add((time) => lenis.raf(time * 1000));
// lenis integrates its own delta
gsap.ticker.lagSmoothing(0);

let cameraBobbingAnim;
// true while the project whose screenshot is the particle model is on screen
let particleProjectActive = false;

// a route can land before the sim exists
let simReady = false;
let pendingRoute = null;
let landingIntroPlayed = false;

// fractions of the distance at which the model fills its box. negatives sit
// inside the cloud
const INSIDE_MODEL_FIT = -0.07;
const THROUGH_MODEL_FIT = -0.15;
const BOB_AMPLITUDE = 2;
const ROUTE_FIT_DURATION = 1.0;

const circle1 = document.querySelector('#circleOne');
const circle2 = document.querySelector('#circleTwo');
const circle3 = document.querySelector('#circleThree');

// the loader logo and the name are animated per character
new SplitType(".LoadingText");
new SplitType(".MyName")

const landingText = document.querySelector('.LandingPageSection');
const introTextFirstLine = landingText.querySelector('h4');
const introTextThirdLine = landingText.querySelector('p');
const loadingAnimationTimeline = gsap.timeline();

// behind an async import chain so load may already have fired
if (document.readyState === "complete") {
    initLoadingAnim();
} else {
    window.addEventListener("load", initLoadingAnim, { once: true });
}

function initLoadingAnim() {
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

    // the gradient blobs behind the blur
    const backgroundBlobTimeline = gsap.timeline({
        repeat: -1,
        yoyo: true,
        repeatDelay: 2,
    });
    InitBackgroundBlobAnimationTimeline(backgroundBlobTimeline);
}

export function initAnim() {
    simReady = true;
    InitCameraBobbing();
    applyRoute(pendingRoute || 'home');
}

// called on every landing. only records the route before the sim exists
export function enterRoute(route) {
    pendingRoute = route;

    if (!simReady) {
        return;
    }

    applyRoute(route);
}

// the loader belongs to the home route only until the intro has run
function retireLoader() {
    const loader = document.querySelector('.LoaderLogoSection');

    if (!loader) {
        return;
    }

    loader.hidden = true;
    delete loader.dataset.route;
}

function applyRoute(route) {
    if (landingIntroPlayed) {
        retireLoader();
    }

    // a mark holds state 0 and would stop the attractors starting
    if (route !== 'work') {
        leaveWork();
    }

    if (route === 'projects') {
        settleBobbing();
        // only runs once. this or the ship hold whichever comes first
        startAttractorMode();
        if (particleProjectActive) {
            frameParticleProject();
        } else {
            setRigTarget(document.querySelector('.ProjectSection'));
            gsap.to(rig, { fit: THROUGH_MODEL_FIT, duration: ROUTE_FIT_DURATION, overwrite: "auto" });
        }
        return;
    }

    if (route === 'work') {
        settleBobbing();
        setRigTarget(document.querySelector('.WorkStage'));
        gsap.to(rig, { fit: 1.0, duration: ROUTE_FIT_DURATION, overwrite: "auto" });
        return;
    }

    cameraBobbingAnim?.resume();
    setRigTarget(document.querySelector('.LandingStage'));

    if (landingIntroPlayed) {
        gsap.to(rig, { fit: 1.0, duration: ROUTE_FIT_DURATION, overwrite: "auto" });
        return;
    }

    landingIntroPlayed = true;
    playLandingIntro();
}

// pulls the camera out from inside the model until it fills its box
function playLandingIntro() {
    const introTl = gsap.timeline({ onComplete: holdShipThenStart });

    introTl.fromTo(introTextFirstLine, { opacity: 0, y: -50 }, { opacity: 1, y: 0, duration: 0.75, ease: "power1"});
    introTl.fromTo(rig, { fit: INSIDE_MODEL_FIT }, { fit: 1.0, duration: 1.75 });
    introTl.fromTo(introTextThirdLine, { opacity: 0, y: -50 }, { opacity: 1, y: 0, duration: 0.75, ease: "power3"});
}

function scrollDownSmoothly() {
    // the loader only sits above the landing on the home route
    if (pendingRoute && pendingRoute !== 'home') {
        return;
    }

    // first input wins
    const userInput = ["wheel", "touchstart", "keydown", "pointerdown"];
    const release = () => userInput.forEach((type) => window.removeEventListener(type, stop));
    const stop = () => {
        // cancel the pending start and halt a run in progress
        delayed.kill();
        lenis.scrollTo(lenis.animatedScroll, { immediate: true });
        release();
    };

    // through lenis so only one thing writes the scroll position
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

// seek to the bob's zero. a plain pause leaves the camera off centre
function settleBobbing() {
    cameraBobbingAnim?.pause(0);
}

function frameParticleProject() {
    setRigTarget(document.querySelector(`project[pos-index="${MODEL_PROJECT}"] .project-image-section`));
    gsap.to(rig, { fit: 1.0, duration: 1.0, overwrite: "auto" });
}

function InitCameraBobbing() {
    cameraBobbingAnim = gsap.timeline({ paused: true, repeat: -1, yoyo: true });
    // absolute not relative. a "+=" tween captures its start value once
    cameraBobbingAnim.to(rig, { bobY: BOB_AMPLITUDE, duration: 3, ease: "sine.inOut" });
    cameraBobbingAnim.play();
}

// the particle project has no screenshot. the model itself is the image
export function animateParticlesIn() {
    particleProjectActive = true;
    frameParticleProject();
    lockAttractor();
}

export function animateParticlesOut() {
    particleProjectActive = false;
    // back to the section. the panel's image box is about to slide off screen
    setRigTarget(document.querySelector('.ProjectSection'));
    gsap.to(rig, { fit: THROUGH_MODEL_FIT, duration: 0.5, overwrite: "auto" });
    resumeCycle();
}
