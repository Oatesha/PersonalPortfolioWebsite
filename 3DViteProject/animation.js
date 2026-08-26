import { gsap } from "gsap";
import SplitType from 'split-type';
import Lenis from "lenis";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { rig, setRigTarget, startAttractorMode, resumeCycle, mobile } from "./cloud.js";
import {
    enterWork,
    leaveWork,
    enterProjects,
    leaveProjects,
    frameParticleProject,
    frameProjectBackdrop,
    isParticleProjectActive,
} from "./sections.js";

// the page's timelines, and what a route does to the cloud and the rig

export const lenis = new Lenis({ autoRaf: false });

gsap.ticker.add((time) => lenis.raf(time * 1000));
lenis.on("scroll", ScrollTrigger.update);
// lenis integrates its own delta
gsap.ticker.lagSmoothing(0);

let cameraBobbingAnim;

// a route can land before the sim exists
let simReady = false;
let pendingRoute = null;
let landingIntroPlayed = false;
// the first route is the page load, anything after is a navigation
let routeLanded = false;

// fractions of the distance at which the model fills its box
const INSIDE_MODEL_FIT = -0.07;
const BOB_AMPLITUDE = 2;
const ROUTE_FIT_DURATION = 1.0;

const loadingAnimationTimeline = gsap.timeline();

let introTextFirstLine = null;
let introTextThirdLine = null;

// runs from main.js in boot order
export function initIntro() {
    new SplitType(".LoadingText");
    new SplitType(".MyName");

    const landingText = document.querySelector('.LandingPageSection');
    introTextFirstLine = landingText.querySelector('.MyName');
    introTextThirdLine = landingText.querySelector('.LandingRole');

    initBlobFollow();

    // behind an async import chain, so load may already have fired
    if (document.readyState === "complete") {
        initLoadingAnim();
    } else {
        window.addEventListener("load", initLoadingAnim, { once: true });
    }
}

function initLoadingAnim() {
    // the landing name is split into .char too
    loadingAnimationTimeline.to(".LoadingText .char", {
        y: 0,
        stagger: 0.1,
        delay: 0.2,
        duration: 0.5,
        ease: "circ",
        onComplete: scrollDownSmoothly,
    });
    loadingAnimationTimeline.to(".LoadingText", {
        autoAlpha: 1,
    }, "<");

    initBlobDrift();
}

export function initAnim() {
    simReady = true;
    initCameraBobbing();
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

        // a phone holds screenshots in the stage, except for the cloud project
        if (!mobile || isParticleProjectActive()) {
            frameParticleProject();
        } else {
            startAttractorMode();
            frameProjectBackdrop();
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

    // the intro belongs to the page opening on the landing
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

// the blob behind the page follows the cursor and drifts on its own

let backgroundAnim = null;
let tweenX = null;
let tweenY = null;

let pointerX = window.innerWidth / 2;
let pointerY = window.innerHeight / 2;
let scrollLeft = 0;
let scrollTop = 0;

function initBlobFollow() {
    backgroundAnim = document.querySelector(".BackgroundAnimation");

    if (!backgroundAnim) {
        return;
    }

    // xPercent carries the centring, leaving x and y free to move the blob on
    // the compositor
    gsap.set(backgroundAnim, { xPercent: -50, yPercent: -50 });

    tweenX = gsap.quickTo(backgroundAnim, "x", { duration: 0.4, ease: "power3" });
    tweenY = gsap.quickTo(backgroundAnim, "y", { duration: 0.4, ease: "power3" });

    document.addEventListener('pointermove', (event) => {
        pointerX = event.clientX;
        pointerY = event.clientY;
        moveBackgroundAnim();
    });

    window.addEventListener('scroll', () => {
        scrollLeft = window.scrollX;
        scrollTop = window.scrollY;
        moveBackgroundAnim();
    }, { passive: true });

    moveBackgroundAnim();
}

function moveBackgroundAnim() {
    tweenX(pointerX + scrollLeft);
    tweenY(pointerY + scrollTop);
}

function initBlobDrift() {
    const circle1 = document.querySelector('#circleOne');
    const circle2 = document.querySelector('#circleTwo');
    const circle3 = document.querySelector('#circleThree');

    const timeline = gsap.timeline({
        repeat: -1,
        yoyo: true,
        repeatDelay: 2,
    });

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
    });
    timeline.to(circle1, {
        duration: 3,
        y: "+=15vh",
        ease: "none",
    }, "<");
}

// seek to the bob's zero
function settleBobbing() {
    cameraBobbingAnim?.pause(0);
}

function initCameraBobbing() {
    cameraBobbingAnim = gsap.timeline({ repeat: -1, yoyo: true });
    // a "+=" tween captures its start value once
    cameraBobbingAnim.to(rig, { bobY: BOB_AMPLITUDE, duration: 3, ease: "sine.inOut" });
}
