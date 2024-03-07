import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/dist/ScrollTrigger";
import Lenis from '@studio-freight/lenis'



const introTextContainer = document.querySelector('.IntroTextCont');
const introHeading = introTextContainer.querySelector('h4');
const name = introTextContainer.querySelector('h1');
const description = introTextContainer.querySelector('p');

const aboutMeSection = document.querySelector('.AboutMeSection');
const aboutMeContent = aboutMeSection.querySelector('.AboutMeContent');


const lenis = new Lenis({
    duration: 1.2,
    easeInOut: true,
    smooth: true, });


function raf(time) {
    lenis.raf(time);
    requestAnimationFrame(raf);
}

requestAnimationFrame(raf);



var introTl = gsap.timeline();
// Animate the text elements
introTl.fromTo(introHeading, { opacity: 0, y: -50 }, { opacity: 1, y: 0, duration: 0.75, ease: "power1"});
introTl.fromTo(name, { opacity: 0, y: -50 }, { opacity: 1, y: 0, duration: 0.75, ease: "power2"});
introTl.fromTo(description, { opacity: 0, y: -50 }, { opacity: 1, y: 0, duration: 0.75, ease: "power3"}, "-=0.25");



// Set initial opacity to 0
gsap.set(aboutMeSection, { opacity: 0 });

lenis.on('scroll', ({ scroll }) => {
    const scrollY = scroll / 1000; // Adjust this value based on your scroll speed preference
  
    gsap.set(introTextContainer, {
      autoAlpha: 1 - scrollY, // Fade out the intro section as you scroll
    });
  
    gsap.set(aboutMeSection, {
      y: scrollY * 50, // Adjust this value based on your desired animation speed
      autoAlpha: scrollY, // Fade in the about me section as you scroll
    });
  });
