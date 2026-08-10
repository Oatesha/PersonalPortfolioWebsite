import { invalidateRigRect } from './cameraRig.js';
import { enterRoute, lenis } from './animation.js';

// routes over one document. the canvas and the webgl context and the sim are
// never torn down. a route only picks which sections are in flow and which box
// the rig frames the model into

// nav false is a route with a url but no entry in the bar. work is out until it
// has real marks and copy
export const ROUTES = [
  { name: 'home', path: '/', label: 'Home' },
  { name: 'projects', path: '/projects', label: 'Projects' },
  // { name: 'work', path: '/work', label: 'Work' },
];

const DEFAULT = ROUTES[0];

let active = null;
const listeners = [];

function routeForPath(pathname) {
  const clean = pathname.replace(/\/+$/, '') || '/';
  return ROUTES.find((route) => route.path === clean) || DEFAULT;
}

export function activeRoute() {
  return active;
}

// called by the nav to light the current entry
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

  // sections only. the route is also stamped on the html element for css
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
