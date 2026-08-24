import { gsap } from "gsap";
import SplitType from 'split-type'
import Lenis from "lenis";
import { rig, setRigTarget } from "./cameraRig.js";
import { startAttractorMode, lockAttractor, resumeCycle } from "./attractors.js";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { enterWork, leaveWork, enterProjects, leaveProjects } from "./sections.js";
import { mobile } from "./main.js";

// on gsap's ticker so everything shares one clock
export const lenis = new Lenis({ autoRaf: false });

gsap.ticker.add((time) => lenis.raf(time * 1000));
lenis.on("scroll", ScrollTrigger.update);
// lenis integrates its own delta
gsap.ticker.lagSmoothing(0);

let cameraBobbingAnim;
let particleProjectActive = false;

// a route can land before the sim exists
let simReady = false;
let pendingRoute = null;
let landingIntroPlayed = false;
// the loader and the intro belong to the page load. anything after the first
// route is a navigation and goes straight to the content
let routeLanded = false;

// fractions of the distance at which the model fills its box. negatives sit
// inside the cloud
const INSIDE_MODEL_FIT = -0.07;
const THROUGH_MODEL_FIT = -0.15;
const BOB_AMPLITUDE = 2;
const ROUTE_FIT_DURATION = 1.0;

const circle1 = document.querySelector('#circleOne');
const circle2 = document.querySelector('#circleTwo');
const circle3 = document.querySelector('#circleThree');

new SplitType(".LoadingText");
new SplitType(".MyName")

const landingText = document.querySelector('.LandingPageSection');
const introTextFirstLine = landingText.querySelector('.MyName');
const introTextThirdLine = landingText.querySelector('.LandingRole');
const loadingAnimationTimeline = gsap.timeline();

// behind an async import chain, so load may already have fired
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
    startAttractorMode();
    applyRoute(pendingRoute || 'home');
}

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
    const opening = !routeLanded;
    routeLanded = true;

    if (landingIntroPlayed || !opening) {
        retireLoader();
    }

    // a mark holds state 0 and would stop the attractors starting
    if (route !== 'work') {
        leaveWork();
    }

    if (route !== 'projects') {
        leaveProjects();
    }

    if (route === 'projects') {
        settleBobbing();

        // a desktop frames the cloud into the stage throughout. a phone holds
        // screenshots there and only hands the box over for the cloud project
        if (!mobile || particleProjectActive) {
            frameParticleProject();
        } else {
            startAttractorMode();
            setRigTarget(document.querySelector('.ProjectSection'));
            gsap.to(rig, { fit: THROUGH_MODEL_FIT, duration: ROUTE_FIT_DURATION, overwrite: "auto" });
        }

        enterProjects();
        return;
    }

    if (route === 'work') {
        settleBobbing();
        setRigTarget(document.querySelector('.WorkStage'));
        gsap.to(rig, { fit: 1.0, duration: ROUTE_FIT_DURATION, overwrite: "auto" });
        enterWork();
        return;
    }

    cameraBobbingAnim?.resume();
    // a project picture left the cloud on a target with the clock stopped
    resumeCycle();
    setRigTarget(document.querySelector('.LandingStage'));

    // the intro is the page opening on the landing, not a trip back to it
    if (landingIntroPlayed || !opening) {
        gsap.to(rig, { fit: 1.0, duration: ROUTE_FIT_DURATION, overwrite: "auto" });
        return;
    }

    landingIntroPlayed = true;
    playLandingIntro();
}

// pulls the camera out from inside the model until it fills its box
function playLandingIntro() {
    const introTl = gsap.timeline();

    introTl.fromTo(introTextFirstLine, { opacity: 0, y: -50 }, { opacity: 1, y: 0, duration: 0.75, ease: "power1"});
    introTl.fromTo(rig, { fit: INSIDE_MODEL_FIT }, { fit: 1.0, duration: 1.75 });
    introTl.fromTo(introTextThirdLine, { opacity: 0, y: -50 }, { opacity: 1, y: 0, duration: 0.75, ease: "power3"});
}

function scrollDownSmoothly() {
    if (pendingRoute && pendingRoute !== 'home') {
        return;
    }

    // first input wins
    const userInput = ["wheel", "touchstart", "keydown", "pointerdown"];
    const release = () => userInput.forEach((type) => window.removeEventListener(type, stop));
    const stop = () => {
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
    setRigTarget(document.querySelector('.ProjectStage'));
    gsap.to(rig, { fit: 1.0, duration: 1.0, overwrite: "auto" });
}

function InitCameraBobbing() {
    cameraBobbingAnim = gsap.timeline({ paused: true, repeat: -1, yoyo: true });
    // absolute not relative. a "+=" tween captures its start value once
    cameraBobbingAnim.to(rig, { bobY: BOB_AMPLITUDE, duration: 3, ease: "sine.inOut" });
    cameraBobbingAnim.play();
}

// the phone stage holds a screenshot for every project but the cloud one, where
// the cloud comes forward into the box instead
export function animateParticlesIn() {
    particleProjectActive = true;
    frameParticleProject();
    lockAttractor();
}

export function animateParticlesOut() {
    particleProjectActive = false;
    setRigTarget(document.querySelector('.ProjectSection'));
    gsap.to(rig, { fit: THROUGH_MODEL_FIT, duration: 0.5, overwrite: "auto" });
    resumeCycle();
}
