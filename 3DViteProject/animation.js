import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";
import { ScrollToPlugin } from "gsap/all";
import SplitType from 'split-type'
import Lenis from "lenis";
import { getSimMaterial, getRenderMaterial } from "./main";
import { rig, setRigTarget } from "./cameraRig.js";

gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

// Lenis was already a dependency and style.css already carried its classes, but
// nothing ever constructed it, so the page ran on native scroll while a GSAP
// scrollTo fought it. Driven from gsap's ticker rather than its own requestAnimationFrame
// so scrolling, tweening and rendering all advance on one clock.
export const lenis = new Lenis({ autoRaf: false });

lenis.on("scroll", ScrollTrigger.update);
gsap.ticker.add((time) => lenis.raf(time * 1000));
// Lenis integrates its own delta; gsap's lag correction would fight it.
gsap.ticker.lagSmoothing(0);

let simMaterial, rendMaterial;
let cameraBobbingAnim;
let middlePageTl = null;
let middlePageTrigger = null;
// True while the project whose "screenshot" is the particle model is on screen.
let particleProjectActive = false;

// Camera framing is expressed as a fraction of the distance at which the model
// exactly fills its target box, so these read the same at every resolution.
// 1.0 fills the box; small negative values sit inside the particle cloud.
const INSIDE_MODEL_FIT = -0.07;
const THROUGH_MODEL_FIT = -0.15;
const BOB_AMPLITUDE = 2;

// framing radius once the cloud is an attractor, measured off the settled
// cloud. the attractor is a roughly isotropic blob rather than a flat
// silhouette, so the extents go with it
const ATTRACTOR_RADIUS = 4;
const ATTRACTOR_EXTENT = { x: 1, y: 1, z: 1 };

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
    // Anyone who starts scrolling during these two and a half seconds was
    // fighting the tween for the rest of its duration. First input wins.
    const userInput = ["wheel", "touchstart", "keydown", "pointerdown"];
    const release = () => userInput.forEach((type) => window.removeEventListener(type, stop));
    const stop = () => {
        // Cancel the pending start, and halt the run in progress where it is.
        delayed.kill();
        lenis.scrollTo(lenis.animatedScroll, { immediate: true });
        release();
    };

    // Routed through Lenis rather than ScrollToPlugin so the two are not both
    // writing the scroll position. The target is the section itself rather than
    // window.innerHeight, which is only equal to it while the viewport height
    // read at call time still holds; when it did not, the landing came to rest
    // slightly past its own top and clipped the name.
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

// distance from this timeline's start to where the project section takes the
// camera off it, so the two points coincide at any aspect ratio
function middlePageScrubLength() {
    const landing = sectionsElements[1];
    const project = document.querySelector(".ProjectSection");
    // Mirrors the two trigger positions: this one starts at the landing's 55%
    // mark, the project one at its own top, both against the viewport centre.
    return project.offsetTop - landing.offsetTop - landing.offsetHeight * 0.55;
}

function InitMiddlePageAnimationTimeline() {
    middlePageTl = gsap.timeline({
        scrollTrigger: {
            trigger: ".LandingPageSection",
            start: "55% center",
            end: () => `+=${middlePageScrubLength()}`,
            // A number rather than true. scrub: true locks the timeline to the
            // scroll position exactly, so every stutter in the wheel or
            // trackpad shows up directly in the camera. This adds catch-up.
            scrub: 0.6,
            onEnter: () => cameraBobbingAnim.pause(),
            onLeaveBack: () => cameraBobbingAnim.resume(),
        },
    });
    middlePageTl.to(rig, { fit: THROUGH_MODEL_FIT, duration: 1.0 });
    // Scrubbed alongside the state flip, so scrolling back up restores the
    // ship's framing as the particles settle back onto its surface.
    middlePageTl.to(rig, { radius: ATTRACTOR_RADIUS, duration: 1.0 }, "<");
    middlePageTl.to(rig.extent, { ...ATTRACTOR_EXTENT, duration: 1.0 }, "<");
    // Snapped, because the shader declares `uniform int state` and three.js
    // hands the value to gl.uniform1i, which truncates. Without this the
    // interpolated 0.0 -> 1.0 reads as 0 for the whole tween and only becomes 1
    // if the timeline lands on exactly 1.0, which makes the attractor appear or
    // not depending on how close to its end the scrub happened to stop.
    middlePageTl.to(simMaterial.uniforms.state, {value: 1, snap: {value: 1}});
    middlePageTl.to(rendMaterial.uniforms.pointSize, {value: 0.5});

    middlePageTrigger = middlePageTl.scrollTrigger;
    InitProjectContextTrigger();
}

// Past its end a scrubbed timeline holds its final value on every update, so
// while the project section is on screen the middle page scrub would keep
// yanking rig.fit back to THROUGH_MODEL_FIT and undo whatever the project
// navigation asked for. Ownership of the camera is handed over explicitly.
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
    // Absolute, not relative. A "+=2" tween captures its start value once, so it
    // snapped whenever anything else wrote to the camera's y position.
    cameraBobbingAnim.to(rig, { bobY: BOB_AMPLITUDE, duration: 3, ease: "sine.inOut" });
    cameraBobbingAnim.play();
}

// The particle project has no screenshot; the model itself is its image. Frame
// it into that project's image box so it lands in the panel rather than being
// nudged towards it with hardcoded camera offsets.
export function animateParticlesIn() {
    particleProjectActive = true;
    frameParticleProject();
}

export function animateParticlesOut() {
    particleProjectActive = false;
    gsap.to(rig, { fit: THROUGH_MODEL_FIT, duration: 0.5, overwrite: "auto" });
}
