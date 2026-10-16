import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import {
  initCloud,
  rig,
  frame,
  resumeCycle,
  setCloudTheme,
  particleSteps,
  getDefaultParticleCount,
  defaultPointSize,
  setParticleCount,
  setPointSize,
} from './cloud.js';
import { initProjects, enterProjects, leaveProjects, initWork, enterWork, leaveWork } from './sections.js';

gsap.registerPlugin(ScrollTrigger);

// The work route is disabled until it has real logos and copy. Its nav link is
// commented out in index.html.
const ROUTES = { home: '/', projects: '/projects' /* , work: '/work' */ };

// Point sizes in device pixels.
const SIZE_STEPS = [0.5, 1, 1.5, 2, 3, 4, 6, 8];

// Negative starts the camera inside the cloud.
const INTRO_FIT = -0.07;

const lenis = new Lenis({ autoRaf: false });
gsap.ticker.add((time) => lenis.raf(time * 1000));
lenis.on('scroll', ScrollTrigger.update);
// Lenis handles its own frame timing, so GSAP's lag smoothing is turned off.
gsap.ticker.lagSmoothing(0);

let route = null;
let simReady = false;
let opened = false;
let bob = null;

initTheme();
initProjects();
if (ROUTES.work) {
  initWork();
}
initIntro();
initBlob();
initRouter();
initCloud((supported) => {
  if (supported) {
    initViewerControls();
  } else {
    document.querySelector('.ViewerControls').remove();
  }
  bob = gsap.to(rig, { bobY: 2, duration: 3, ease: 'sine.inOut', repeat: -1, yoyo: true });
  simReady = true;
  applyRoute();
});

function initRouter() {
  document.querySelectorAll('a[data-route]').forEach((link) => {
    link.addEventListener('click', (event) => {
      // Let modified clicks (new tab, new window) follow the real href.
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) {
        return;
      }
      event.preventDefault();
      navigate(link.dataset.route, true);
    });
  });

  window.addEventListener('popstate', () => navigate(routeForPath(), false));

  const landing = routeForPath();
  history.replaceState(null, '', ROUTES[landing]);
  navigate(landing, false);
}

function routeForPath() {
  const path = location.pathname.replace(/\/+$/, '') || '/';
  return Object.keys(ROUTES).find((name) => ROUTES[name] === path) || 'home';
}

function navigate(name, push) {
  if (name === route) {
    return;
  }
  route = name;

  if (push) {
    history.pushState(null, '', ROUTES[route]);
  }

  document.querySelectorAll('section[data-route]').forEach((section) => {
    section.hidden = section.dataset.route !== route;
  });
  document.querySelectorAll('.NavLink').forEach((link) => {
    if (link.dataset.route === route) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  });

  lenis.scrollTo(0, { immediate: true });

  if (simReady) {
    applyRoute();
  }
}

function applyRoute() {
  // The loader only plays on first load.
  if (opened) {
    document.querySelector('.LoaderLogoSection')?.remove();
  }

  // Clear any picture the route left on the cloud, so the attractors can run.
  if (route !== 'work') {
    leaveWork();
  }
  if (route !== 'projects') {
    leaveProjects();
  }

  if (route === 'home') {
    bob.resume();
    resumeCycle();
    if (opened) {
      frame(document.querySelector('.LandingStage'));
    } else {
      playLandingIntro();
    }
  } else {
    // Pause the bob at its rest position.
    bob.pause(0);
    if (route === 'projects') {
      enterProjects();
    } else {
      enterWork();
    }
  }

  opened = true;
}

function playLandingIntro() {
  frame(document.querySelector('.LandingStage'), { fit: INTRO_FIT, duration: 0 });

  gsap.timeline()
    .fromTo('.MyName', { opacity: 0, y: -50 }, { opacity: 1, y: 0, duration: 0.75, ease: 'power1' })
    .to(rig, { fit: 1, duration: 1.75 })
    .fromTo('.LandingRole', { opacity: 0, y: -50 }, { opacity: 1, y: 0, duration: 0.75, ease: 'power3' });
}

function initIntro() {
  const play = () => {
    gsap.timeline()
      .to('.LoadingText span', { y: 0, stagger: 0.1, delay: 0.2, duration: 0.5, ease: 'circ', onComplete: scrollToLanding })
      .to('.LoadingText', { autoAlpha: 1 }, '<');
  };

  // Module scripts can run after the load event has already fired.
  if (document.readyState === 'complete') {
    play();
  } else {
    window.addEventListener('load', play, { once: true });
  }
}

function scrollToLanding() {
  if (route !== 'home') {
    return;
  }

  // Any user input cancels the automatic scroll.
  const inputs = ['wheel', 'touchstart', 'keydown', 'pointerdown'];
  const release = () => inputs.forEach((type) => window.removeEventListener(type, stop));
  const stop = () => {
    delayed.kill();
    lenis.scrollTo(lenis.animatedScroll, { immediate: true });
    release();
  };

  const delayed = gsap.delayedCall(0.25, () => {
    lenis.scrollTo('.LandingPageSection', { duration: 2.5, onComplete: release });
  });

  inputs.forEach((type) => window.addEventListener(type, stop, { passive: true }));
}

function initBlob() {
  const blob = document.querySelector('.BackgroundAnimation');

  // Centre with xPercent/yPercent so x and y are free to follow the pointer.
  gsap.set(blob, { xPercent: -50, yPercent: -50 });
  const toX = gsap.quickTo(blob, 'x', { duration: 0.4, ease: 'power3' });
  const toY = gsap.quickTo(blob, 'y', { duration: 0.4, ease: 'power3' });

  let pointerX = window.innerWidth / 2;
  let pointerY = window.innerHeight / 2;
  const follow = () => {
    toX(pointerX + window.scrollX);
    toY(pointerY + window.scrollY);
  };

  document.addEventListener('pointermove', (event) => {
    pointerX = event.clientX;
    pointerY = event.clientY;
    follow();
  });
  window.addEventListener('scroll', follow, { passive: true });
  follow();

  gsap.timeline({ repeat: -1, yoyo: true, repeatDelay: 2, defaults: { ease: 'none' } })
    .to('#circleOne', { duration: 4, y: '-=5vh' })
    .to('#circleTwo', { duration: 4, y: '+=5vh' }, '<')
    .to('#circleThree', { duration: 6, x: '+=10vw', scale: 1.5 }, '<')
    .to('#circleThree', { duration: 6, y: '-=10vh', x: '+=4vw', scale: 1 })
    .to('#circleOne', { duration: 4, y: '+=5vh' }, '<')
    .to('#circleTwo', { duration: 4, y: '-=5vh', x: '+=2.5vw' }, '<')
    .to('#circleTwo', { duration: 6, y: '-=12.5vh', scale: 1.5, zIndex: 2 })
    .to('#circleOne', { duration: 3, y: '+=15vh' }, '<');
}

function initTheme() {
  const button = document.querySelector('.ThemeToggle');

  const setTheme = (name) => {
    document.documentElement.dataset.theme = name;
    button.setAttribute('aria-pressed', String(name === 'dark'));
    setCloudTheme(name);
    try {
      localStorage.setItem('ho-theme', name);
    } catch {
      // Storage can be unavailable, e.g. in private browsing.
    }
  };

  let stored = null;
  try {
    stored = localStorage.getItem('ho-theme');
  } catch {
    // Same as above.
  }

  const preferred = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  setTheme(stored === 'light' || stored === 'dark' ? stored : preferred);

  button.addEventListener('click', () => {
    setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  });
}

function abbreviate(count) {
  if (count >= 1e6) return `${+(count / 1e6).toFixed(1)}M`;
  if (count >= 1e3) return `${+(count / 1e3).toFixed(1)}k`;
  return String(count);
}

// Slider values are indices into stops, so the thumb snaps to each stop.
function initSlider(input, stops, start, format, apply) {
  const output = input.parentElement.querySelector('output');
  const nearest = stops.reduce((best, stop, i) => (Math.abs(stop - start) < Math.abs(stops[best] - start) ? i : best), 0);

  input.max = stops.length - 1;
  input.value = nearest;

  const update = () => {
    const value = stops[input.value];
    output.textContent = format(value);
    apply(value);
  };
  input.addEventListener('input', update);
  update();
}

function initViewerControls() {
  initSlider(document.querySelector('#particleSize'), SIZE_STEPS, defaultPointSize(), (size) => size.toFixed(1), setPointSize);
  initSlider(document.querySelector('#particleCount'), particleSteps(), getDefaultParticleCount(), abbreviate, setParticleCount);
}
