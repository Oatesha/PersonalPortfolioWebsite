import { gsap } from 'gsap';
import {
  invalidateRigRect,
  setCloudPalette,
  cloudReady,
  getParticleSteps,
  getDefaultParticleCount,
  getDefaultPointSize,
  setParticleCount,
  setPointSize,
} from './cloud.js';
import { enterRoute, lenis } from './animation.js';

// the page around the cloud: routes, the nav bar, the theme and the two sliders

// work is commented out until it has real marks and copy
const ROUTES = [
  { name: 'home', path: '/', label: 'Home' },
  { name: 'projects', path: '/projects', label: 'Projects' },
  // { name: 'work', path: '/work', label: 'Work' },
];

const DEFAULT_ROUTE = ROUTES[0];

let active = null;
const routeListeners = [];

let toggle = null;
let panel = null;

export function initPage() {
  initTheme();
  renderNav();
  initViewerControls();
}

// routes over one document. the canvas, the webgl context and the sim are never
// torn down. a route only picks which sections are in flow and which box the
// rig frames the model into
export function initRouter() {
  window.addEventListener('popstate', (event) => {
    navigate(event.state?.route || routeForPath(location.pathname).name, { push: false });
  });

  const landing = routeForPath(location.pathname);
  history.replaceState({ route: landing.name }, '', landing.path);
  navigate(landing.name, { push: false });
}

function routeForPath(pathname) {
  const clean = pathname.replace(/\/+$/, '') || '/';
  return ROUTES.find((route) => route.path === clean) || DEFAULT_ROUTE;
}

function onRoute(listener) {
  routeListeners.push(listener);
  if (active) {
    listener(active);
  }
}

function navigate(name, { push = true } = {}) {
  const route = ROUTES.find((candidate) => candidate.name === name) || DEFAULT_ROUTE;

  if (active === route) {
    return;
  }

  active = route;

  if (push) {
    history.pushState({ route: route.name }, '', route.path);
  }

  document.querySelectorAll('section[data-route]').forEach((section) => {
    section.hidden = section.dataset.route !== route.name;
  });

  document.documentElement.dataset.route = route.name;

  // the sections that just came into flow have not been measured yet
  invalidateRigRect();
  lenis.scrollTo(0, { immediate: true });
  enterRoute(route.name);

  routeListeners.forEach((listener) => listener(route));
}

// the href stays real so a middle click still opens the url
function bindRouteLinks(scope, onNavigate) {
  scope.querySelectorAll('[data-nav-route]').forEach((link) => {
    link.addEventListener('click', (event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) {
        return;
      }
      event.preventDefault();
      navigate(link.dataset.navRoute);
      onNavigate?.();
    });
  });
}

function setOpen(open) {
  toggle.setAttribute('aria-expanded', String(open));
  panel.classList.toggle('is-open', open);
}

function isOpen() {
  return toggle.getAttribute('aria-expanded') === 'true';
}

// the bar across the top. the links only collapse behind the hamburger on a phone
function renderNav() {
  const root = document.querySelector('.NavRoot');

  if (!root) {
    return;
  }

  root.innerHTML = `
    <a class="NavMark" href="/" data-nav-route="home" aria-label="Harrison Oates, home">HO.</a>
    <div class="NavRight">
      <button class="NavToggle" type="button" aria-expanded="false" aria-controls="nav-panel" aria-label="Menu">
        <span class="NavBar"></span>
        <span class="NavBar"></span>
        <span class="NavBar"></span>
      </button>
      <nav class="NavPanel" id="nav-panel" aria-label="Sections">
        ${ROUTES.filter((route) => route.nav !== false)
          .map(
            (route) => `<a class="NavLink" href="${route.path}" data-nav-route="${route.name}">${route.label}</a>`,
          )
          .join('')}
        <button class="ThemeToggle" type="button" aria-pressed="false">
          <span class="ThemeDisc" aria-hidden="true"></span>
        </button>
      </nav>
    </div>`;

  toggle = root.querySelector('.NavToggle');
  panel = root.querySelector('.NavPanel');

  toggle.addEventListener('click', () => setOpen(!isOpen()));

  bindRouteLinks(root, () => setOpen(false));

  const themeButton = root.querySelector('.ThemeToggle');
  themeButton.addEventListener('click', () => setTheme(activeTheme === 'dark' ? 'light' : 'dark'));

  onTheme((name) => {
    themeButton.setAttribute('aria-pressed', String(name === 'dark'));
    themeButton.setAttribute('aria-label', name === 'dark' ? 'Switch to light' : 'Switch to dark');
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isOpen()) {
      setOpen(false);
      toggle.focus();
    }
  });

  // a press anywhere else closes it, but not the press that opened it
  document.addEventListener('pointerdown', (event) => {
    if (isOpen() && !root.contains(event.target)) {
      setOpen(false);
    }
  });

  onRoute((route) => {
    document.querySelectorAll('.NavLink').forEach((link) => {
      if (link.dataset.navRoute === route.name) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    });
  });
}

// the palette lives in style.css. the cloud reads the same custom properties
// through here, so a theme is one token swap

const THEMES = ['light', 'dark'];
// namespaced because every project on localhost shares one origin
const STORAGE_KEY = 'ho-theme';

// the bare :root in style.css carries this same palette so the first paint does
// not flash the other one
const DEFAULT_THEME = 'dark';

const themeListeners = [];

let activeTheme = DEFAULT_THEME;

function onTheme(listener) {
  themeListeners.push(listener);
  listener(activeTheme);
}

// channels as written. THREE.Color would linearise them and the shader writes
// its result straight out
function readColour(styles, token) {
  const hex = styles.getPropertyValue(token).trim().replace('#', '');

  if (hex.length !== 6) {
    return null;
  }

  const packed = parseInt(hex, 16);

  return [
    ((packed >> 16) & 0xff) / 255,
    ((packed >> 8) & 0xff) / 255,
    (packed & 0xff) / 255,
  ];
}

function readPalette() {
  const styles = getComputedStyle(document.documentElement);
  const palette = {};

  [
    ['rampLow', '--particle-low'],
    ['rampMid', '--particle-mid'],
    ['rampHigh', '--particle-high'],
    ['baseTint', '--particle-tint'],
  ].forEach(([uniform, token]) => {
    const colour = readColour(styles, token);

    if (colour) {
      palette[uniform] = colour;
    }
  });

  palette.gain = Number(styles.getPropertyValue('--particle-gain'));
  palette.desaturate = Number(styles.getPropertyValue('--particle-desaturate'));

  return palette;
}

function setTheme(name) {
  activeTheme = THEMES.includes(name) ? name : DEFAULT_THEME;

  document.documentElement.dataset.theme = activeTheme;

  try {
    localStorage.setItem(STORAGE_KEY, activeTheme);
  } catch {
    // private browsing. the theme does not survive the tab
  }

  setCloudPalette(readPalette());
  themeListeners.forEach((listener) => listener(activeTheme));
}

function initTheme() {
  let stored = null;

  try {
    stored = localStorage.getItem(STORAGE_KEY);
  } catch {
    stored = null;
  }

  setTheme(stored || DEFAULT_THEME);
}

// both sliders run over indices into a list of stops, so every position is a
// value you can land on

// gl_PointSize in pixels. coarse at the bottom where half a pixel is the
// difference between a haze and a solid
const SIZE_STEPS = [0.5, 1, 1.5, 2, 3, 4, 6, 8];

const READY_POLL = 0.25;

let sizeInput = null;
let countInput = null;
let sizeOutput = null;
let countOutput = null;
let countSteps = [];

function abbreviate(count) {
  if (count >= 1000000) {
    const millions = count / 1000000;
    return `${Number.isInteger(millions) ? millions : millions.toFixed(1)}M`;
  }
  if (count >= 1000) {
    const thousands = count / 1000;
    return `${Number.isInteger(thousands) ? thousands : thousands.toFixed(1)}k`;
  }
  return String(count);
}

function formatSize(size) {
  return size.toFixed(1);
}

function applySize() {
  const size = SIZE_STEPS[Number(sizeInput.value)];
  sizeOutput.textContent = formatSize(size);
  setPointSize(size);
}

function applyCount() {
  if (!countSteps.length) {
    return;
  }
  const wanted = countSteps[Number(countInput.value)];
  countOutput.textContent = abbreviate(setParticleCount(wanted) || wanted);
}

// reserve the width of the longest label so the row holds still while you drag
function reserveWidth(output, labels) {
  const widest = labels.reduce((longest, label) => Math.max(longest, label.length), 1);
  output.style.minWidth = `${widest}ch`;
}

// the stops are not painted onto the track. the index makes the thumb land on
// one anyway and the datalist is filled in for screen readers
function buildSlider(input, listId, stops, format, startIndex) {
  input.min = 0;
  input.max = Math.max(0, stops.length - 1);
  input.step = 1;
  input.value = String(startIndex);

  const ticks = document.querySelector(listId);
  if (ticks) {
    ticks.replaceChildren(
      ...stops.map((stop, index) => {
        const option = document.createElement('option');
        option.value = String(index);
        option.label = format(stop);
        return option;
      }),
    );
  }

  return stops.map(format);
}

function nearestIndex(stops, wanted) {
  let nearest = 0;
  stops.forEach((stop, index) => {
    if (Math.abs(stop - wanted) < Math.abs(stops[nearest] - wanted)) {
      nearest = index;
    }
  });
  return nearest;
}

// the count's stops depend on a texture sized behind the gpu tier probe, so
// this slider cannot be built until the sim is up. polled off gsap's ticker
// rather than setTimeout so it stops with the tab
function waitForSimulation() {
  if (!cloudReady()) {
    gsap.delayedCall(READY_POLL, waitForSimulation);
    return;
  }

  countSteps = getParticleSteps();
  reserveWidth(
    countOutput,
    buildSlider(
      countInput,
      '#particleCountTicks',
      countSteps,
      abbreviate,
      nearestIndex(countSteps, getDefaultParticleCount()),
    ),
  );

  applySize();
  applyCount();
}

function initViewerControls() {
  sizeInput = document.querySelector('#particleSizeInput');
  countInput = document.querySelector('#particleCountInput');

  if (!sizeInput || !countInput) {
    return;
  }

  sizeOutput = document.querySelector(`output[for="${sizeInput.id}"]`);
  countOutput = document.querySelector(`output[for="${countInput.id}"]`);

  // size depends on nothing the sim has to resolve, so it is live from first paint
  reserveWidth(
    sizeOutput,
    buildSlider(
      sizeInput,
      '#particleSizeTicks',
      SIZE_STEPS,
      formatSize,
      nearestIndex(SIZE_STEPS, getDefaultPointSize()),
    ),
  );

  sizeInput.addEventListener('input', applySize);
  countInput.addEventListener('input', applyCount);

  waitForSimulation();
}
