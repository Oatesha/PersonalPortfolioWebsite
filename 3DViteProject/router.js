import { invalidateRigRect } from './cameraRig.js';
import { enterRoute, lenis } from './animation.js';
import { toggleTheme, onTheme } from './theme.js';

// routes over one document. the canvas, the webgl context and the sim are never
// torn down. a route only picks which sections are in flow and which box the rig
// frames the model into

// work is commented out until it has real marks and copy
export const ROUTES = [
  { name: 'home', path: '/', label: 'Home' },
  { name: 'projects', path: '/projects', label: 'Projects' },
  // { name: 'work', path: '/work', label: 'Work' },
];

const DEFAULT = ROUTES[0];

let active = null;
const listeners = [];

let toggle = null;
let panel = null;

function routeForPath(pathname) {
  const clean = pathname.replace(/\/+$/, '') || '/';
  return ROUTES.find((route) => route.path === clean) || DEFAULT;
}

export function activeRoute() {
  return active;
}

export function onRoute(listener) {
  listeners.push(listener);
  if (active) {
    listener(active);
  }
}

export function navigate(name, { push = true } = {}) {
  const route = ROUTES.find((candidate) => candidate.name === name) || DEFAULT;

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

  listeners.forEach((listener) => listener(route));
}

export function initRouter() {
  window.addEventListener('popstate', (event) => {
    navigate(event.state?.route || routeForPath(location.pathname).name, { push: false });
  });

  const landing = routeForPath(location.pathname);
  history.replaceState({ route: landing.name }, '', landing.path);
  navigate(landing.name, { push: false });
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
export function renderNav() {
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

  const theme = root.querySelector('.ThemeToggle');
  theme.addEventListener('click', () => toggleTheme());

  onTheme((name) => {
    theme.setAttribute('aria-pressed', String(name === 'dark'));
    theme.setAttribute('aria-label', name === 'dark' ? 'Switch to light' : 'Switch to dark');
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
