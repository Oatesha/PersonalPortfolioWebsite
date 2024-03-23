import { gsap } from "gsap";

const hamburgerMenu = document.querySelector(".HamburgerToggle");
const menu = document.querySelector(".MenuElements");
console.log(menu);

hamburgerMenu.addEventListener("click", toggleMenu);
hamburgerMenu.addEventListener("mouseenter", hoverHamburger);
hamburgerMenu.addEventListener("mouseleave", exitHoverHamburger);

let menuVisible = false;
let targetAlpha;

function toggleMenu() {
    menuVisible ? targetAlpha = 0.0 : targetAlpha = 1.0; 
    menuVisible = !menuVisible;

    gsap.to(menu, {
        autoAlpha: targetAlpha,
        duration: 0.5,
    })
}

function hoverHamburger() {
    console.log("hovered");
}

function exitHoverHamburger() {
    console.log("left");
}