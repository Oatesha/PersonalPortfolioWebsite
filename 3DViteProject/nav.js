import { ROUTES, navigate, onRoute } from './router.js';
import { toggleTheme, onTheme } from './theme.js';

// the bar across the top. the links sit in the bar itself and only collapse
// behind the hamburger on a phone

let toggle = null;
let panel = null;

// any anchor carrying a route name is routed. the href stays real so a middle
// click still opens the url
function bindRouteLinks(scope, onNavigate) {
  scope.querySelectorAll('[data-nav-route]').forEach((link) => {
    link.addEventListener('click', (event) => {
      // plain left click only
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

  // the wordmark routes home too
  bindRouteLinks(root, () => setOpen(false));

  // the footer's colophon link is outside the bar
  const footer = document.querySelector('.SiteFooter');

  if (footer) {
    bindRouteLinks(footer);
  }

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
    document.querySelectorAll('.NavLink, .SiteFooterLink').forEach((link) => {
      if (link.dataset.navRoute === route.name) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    });
  });
}
