import { getRenderMaterial } from './main.js';

// the palette lives in style.css. the cloud reads the same custom properties
// through here, so a theme is one token swap

const THEMES = ['light', 'dark'];
// namespaced because every project on localhost shares one origin
const STORAGE_KEY = 'ho-theme';

// the bare :root in style.css carries this same palette so the first paint does
// not flash the other one
const DEFAULT = 'dark';

const listeners = [];

let active = DEFAULT;

export function currentTheme() {
  return active;
}

export function onTheme(listener) {
  listeners.push(listener);
  listener(active);
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

// a theme can land before there is a material to paint. main.js calls this again
export function applyCloudPalette() {
  const material = getRenderMaterial();

  if (!material) {
    return;
  }

  const styles = getComputedStyle(document.documentElement);

  [
    ['rampLow', '--particle-low'],
    ['rampMid', '--particle-mid'],
    ['rampHigh', '--particle-high'],
    ['baseTint', '--particle-tint'],
  ].forEach(([uniform, token]) => {
    const colour = readColour(styles, token);

    if (colour) {
      material.uniforms[uniform].value.set(...colour);
    }
  });

  const gain = Number(styles.getPropertyValue('--particle-gain'));

  if (Number.isFinite(gain)) {
    material.uniforms.baseGain.value.setScalar(gain);
  }

  const desaturate = Number(styles.getPropertyValue('--particle-desaturate'));

  if (Number.isFinite(desaturate)) {
    material.uniforms.baseDesaturate.value = desaturate;
  }
}

export function setTheme(name) {
  active = THEMES.includes(name) ? name : DEFAULT;

  document.documentElement.dataset.theme = active;

  try {
    localStorage.setItem(STORAGE_KEY, active);
  } catch {
    // private browsing. the theme does not survive the tab
  }

  applyCloudPalette();
  listeners.forEach((listener) => listener(active));
}

export function toggleTheme() {
  setTheme(active === 'dark' ? 'light' : 'dark');
}

export function initTheme() {
  let stored = null;

  try {
    stored = localStorage.getItem(STORAGE_KEY);
  } catch {
    stored = null;
  }

  setTheme(stored || DEFAULT);
}
