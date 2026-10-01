import * as THREE from 'three';
import gsap from 'gsap';
import { getGPUTier } from 'detect-gpu';
import { quadVert, simFrag, pointVert, pointFrag, markFrag } from './shaders.js';

const MAX_PIXEL_RATIO = 2;

// sim steps per 60Hz frame
const SIM_SPEED = 2.4;

// side of the sim texture, so the ceiling on particle count
const TEXTURE_SIDE = 1280;
const MOBILE_TEXTURE_SIDE = 256;

const PARTICLE_STEPS = [25000, 50000, 100000, 250000, 500000, 750000, 1000000];

// matches WORLD_RADIUS in shaders.js
const RADIUS = 4;

// the cloud zooms in from this on load
const INTRO_RADIUS = 24;

const FIT_MARGIN = 1.05;
const TARGET_CROSSFADE = 1.2;
const MORPH_DURATION = 2.4;
const CYCLE_INTERVAL = 10;

// order must match the constants in shaders.js
const ATTRACTORS = ['Thomas', 'Lorenz', 'Rössler', 'Halvorsen', 'Dadras'];
const START_ATTRACTOR = 1;
const PROJECT_ATTRACTOR = 4;
const MARK = -2;

const MASK_SIDE = 1024;
const MARK_DEPTH = 0.04;

// the colours are applied as written, so they skip three's srgb conversion
const PALETTES = {
  light: { low: 0x8f8c86, mid: 0xc2551a, high: 0x1a1917, tint: 0xffe2cd, gain: 0.42, desaturate: 0.92 },
  dark: { low: 0x4a2311, mid: 0xff8a3c, high: 0xf7f3ef, tint: 0xffcfae, gain: 0.95, desaturate: 0.88 },
};

export const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|Windows Phone/i.test(navigator.userAgent);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ alpha: true });
const scene = new THREE.Scene();
const clock = new THREE.Clock();
const pointer = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
let pointerActive = false;

const quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1);

let simMaterial, pointMaterial, simScene, readTarget, writeTarget;
let geometry = null;
let particleTotal = 0;
let defaultParticleCount = 250000;
let theme = 'dark';

export const rig = {
  target: null,
  radius: INTRO_RADIUS,
  // half extents as multiples of radius
  extent: { x: 1, y: 1, z: 1 },
  // fraction of the fitted distance. negative passes through the cloud
  fit: 1,
  bobY: 0,
};

// three only promotes ShaderMaterial to glsl 3 on webgl2, and the point shader
// unpacks colour with bitwise ops
function supported() {
  return renderer.capabilities.isWebGL2
    && renderer.capabilities.floatVertexTextures
    && renderer.extensions.has('EXT_color_buffer_float');
}

export function initCloud(onReady) {
  if (!supported()) {
    console.warn('no webgl2 float render targets, the cloud will not run');
    onReady(false);
    return;
  }

  initShapeSwitch();

  renderer.setPixelRatio(pixelRatio());
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.id = 'threeJSCanvas';
  document.body.appendChild(renderer.domElement);

  document.addEventListener('pointermove', (event) => {
    pointerActive = true;
    pointer.set((event.clientX / window.innerWidth) * 2 - 1, -(event.clientY / window.innerHeight) * 2 + 1);
  });
  // otherwise the dent freezes into the cloud
  document.addEventListener('pointerleave', () => (pointerActive = false));
  window.addEventListener('blur', () => (pointerActive = false));
  window.addEventListener('resize', () => {
    renderer.setPixelRatio(pixelRatio());
    renderer.setSize(window.innerWidth, window.innerHeight);
    rigRect = null;
  });

  getGPUTier().then(({ tier }) => {
    initSim(tier);
    onReady(true);
  });
}

function pixelRatio() {
  return Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO);
}

// gl_PointSize is in device pixels, so a 1x display has four times the cell to cover
export function defaultPointSize() {
  return pixelRatio() >= 2 ? 1.0 : 1.5;
}

function floatTexture(data, side) {
  const texture = new THREE.DataTexture(data, side, side, THREE.RGBAFormat, THREE.FloatType);
  // a DataTexture sits at version 0 until this is set, and three uploads nothing
  texture.needsUpdate = true;
  return texture;
}

function floatTarget(side) {
  return new THREE.WebGLRenderTarget(side, side, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    type: THREE.FloatType,
    depthBuffer: false,
  });
}

function quadScene(material) {
  const quad = new THREE.Scene();
  quad.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));
  return quad;
}

function initSim(tier) {
  const side = mobile ? MOBILE_TEXTURE_SIDE : TEXTURE_SIDE;
  particleTotal = side * side;
  // a picture lays one cell per particle, so short of the total is holes in it
  defaultParticleCount = tier >= 2 ? particleTotal : tier === 1 ? 1000000 : 250000;

  const scattered = new Float32Array(particleTotal * 4);
  for (let i = 0; i < particleTotal; i++) {
    const distance = Math.sqrt(Math.random()) * 20.0;
    const theta = THREE.MathUtils.randFloatSpread(360);
    const phi = THREE.MathUtils.randFloatSpread(360);
    scattered[i * 4] = distance * Math.sin(theta) * Math.cos(phi);
    scattered[i * 4 + 1] = distance * Math.sin(theta) * Math.sin(phi);
    scattered[i * 4 + 2] = distance * Math.cos(theta);
    // packed white, so the cloud opens on the page tint
    scattered[i * 4 + 3] = 0xffffff;
  }
  const start = floatTexture(scattered, side);
  activeTarget = start;

  simMaterial = new THREE.ShaderMaterial({
    uniforms: {
      // 0 pulls every particle to its point on the target, 1 runs an attractor
      state: { value: 0 },
      dtScale: { value: 1 },
      attractorFrom: { value: 0 },
      attractorTo: { value: 0 },
      morph: { value: 1 },
      posTex: { value: start },
      targetTexA: { value: start },
      targetTexB: { value: start },
      targetMix: { value: 0 },
      mouseOrigin: { value: new THREE.Vector3() },
      mouseDir: { value: new THREE.Vector3(0, 0, -1) },
      mouseActive: { value: 0 },
    },
    vertexShader: quadVert,
    fragmentShader: simFrag,
  });
  simScene = quadScene(simMaterial);

  // a target cannot be read and written in one pass
  readTarget = floatTarget(side);
  writeTarget = floatTarget(side);
  for (const target of [readTarget, writeTarget]) {
    renderer.setRenderTarget(target);
    renderer.render(simScene, quadCamera);
  }
  renderer.setRenderTarget(null);

  pointMaterial = new THREE.ShaderMaterial({
    uniforms: {
      posTex: { value: start },
      targetTexA: { value: start },
      targetTexB: { value: start },
      targetMix: { value: 0 },
      pointSize: { value: defaultPointSize() },
      // 0 paints the target's own colours, 1 paints particle speed
      colourMix: { value: 0 },
      rampLow: { value: new THREE.Color() },
      rampMid: { value: new THREE.Color() },
      rampHigh: { value: new THREE.Color() },
      baseTint: { value: new THREE.Color() },
      baseGain: { value: 1 },
      baseDesaturate: { value: 0 },
      // 1 where a slot's colours want grading to the page palette
      gradeA: { value: 1 },
      gradeB: { value: 1 },
    },
    vertexShader: pointVert,
    fragmentShader: pointFrag,
  });
  applyPalette();

  // texel order is position order in a picture, so a prefix of it cuts a band
  // out. shuffled once, any prefix is a fair sample
  const order = new Uint32Array(particleTotal).map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const swap = Math.floor(Math.random() * (i + 1));
    [order[i], order[swap]] = [order[swap], order[i]];
  }

  // a particle's position is its sim texel
  const positions = new Float32Array(particleTotal * 2);
  order.forEach((texel, i) => {
    positions[i * 2] = ((texel % side) + 0.5) / side;
    positions[i * 2 + 1] = (Math.floor(texel / side) + 0.5) / side;
  });

  geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 2));
  // getZ off a two component buffer is NaN, and three computes this to sort
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 16);

  const points = new THREE.Points(geometry, pointMaterial);
  points.frustumCulled = false;
  scene.add(points);

  initMarks(side);

  gsap.ticker.add(render);

  cycling = !manual;
  const first = manual ? current : START_ATTRACTOR;
  current = -1;
  applyShape(first);
}

function render() {
  // some browsers still tick a backgrounded tab
  if (document.hidden) {
    return;
  }

  // capped so a dropped frame cannot blow up the attractor
  simMaterial.uniforms.dtScale.value = Math.min(clock.getDelta() * 60, 2) * SIM_SPEED;

  updateCamera();

  [readTarget, writeTarget] = [writeTarget, readTarget];
  simMaterial.uniforms.posTex.value = readTarget.texture;
  renderer.setRenderTarget(writeTarget);
  renderer.render(simScene, quadCamera);
  renderer.setRenderTarget(null);
  pointMaterial.uniforms.posTex.value = writeTarget.texture;

  renderer.render(scene, camera);

  // after the render so the view offset is already in the projection
  raycaster.setFromCamera(pointer, camera);
  simMaterial.uniforms.mouseOrigin.value.copy(raycaster.ray.origin);
  simMaterial.uniforms.mouseDir.value.copy(raycaster.ray.direction);
  simMaterial.uniforms.mouseActive.value = pointerActive ? 1 : 0;
}

export function particleSteps() {
  const steps = PARTICLE_STEPS.filter((count) => count <= particleTotal);
  if (!steps.length || steps[steps.length - 1] < particleTotal * 0.9) {
    steps.push(particleTotal);
  }
  return steps;
}

export function getDefaultParticleCount() {
  return defaultParticleCount;
}

// draws a prefix of the shuffled buffer
export function setParticleCount(count) {
  geometry.setDrawRange(0, count);
}

export function setPointSize(size) {
  pointMaterial.uniforms.pointSize.value = size;
}

export function setCloudTheme(name) {
  theme = name;
  applyPalette();
}

function applyPalette() {
  if (!pointMaterial) {
    return;
  }
  const palette = PALETTES[theme];
  const uniforms = pointMaterial.uniforms;
  uniforms.rampLow.value.setHex(palette.low, THREE.NoColorSpace);
  uniforms.rampMid.value.setHex(palette.mid, THREE.NoColorSpace);
  uniforms.rampHigh.value.setHex(palette.high, THREE.NoColorSpace);
  uniforms.baseTint.value.setHex(palette.tint, THREE.NoColorSpace);
  uniforms.baseGain.value = palette.gain;
  uniforms.baseDesaturate.value = palette.desaturate;
}

// two target slots. the new texture goes in the one the cloud is not reading,
// then it crossfades over
let activeSlot = 0;
let activeTarget = null;
let targetTween = null;

function setCloudTarget(texture, graded) {
  if (texture === activeTarget) {
    return;
  }
  activeTarget = texture;

  const free = activeSlot === 0 ? 'B' : 'A';
  simMaterial.uniforms[`targetTex${free}`].value = texture;
  pointMaterial.uniforms[`targetTex${free}`].value = texture;
  pointMaterial.uniforms[`grade${free}`].value = graded;
  activeSlot = 1 - activeSlot;

  targetTween?.kill();
  targetTween = gsap.to([simMaterial.uniforms.targetMix, pointMaterial.uniforms.targetMix], {
    value: activeSlot,
    duration: TARGET_CROSSFADE,
    ease: 'power2.inOut',
  });
}

// the canvas is fullscreen but the cloud is framed in a DOM element.
// setViewOffset runs backwards: the frustum is the element, the sub rect is the viewport

// in document coordinates so a scroll needs no new layout
let rigRect = null;
const resizeObserver = new ResizeObserver(() => (rigRect = null));

export function frame(element, { fit = 1, duration = 1 } = {}) {
  if (rig.target !== element) {
    if (rig.target) {
      resizeObserver.unobserve(rig.target);
    }
    resizeObserver.observe(element);
    rig.target = element;
  }
  rigRect = null;
  gsap.to(rig, { fit, duration, overwrite: 'auto' });
}

function measureRig() {
  const rect = rig.target?.getBoundingClientRect();

  // a hidden target frames the viewport until the observer sees it sized
  if (!rect || rect.width < 1 || rect.height < 1) {
    return { left: window.scrollX, top: window.scrollY, width: window.innerWidth, height: window.innerHeight };
  }

  rigRect = { left: rect.left + window.scrollX, top: rect.top + window.scrollY, width: rect.width, height: rect.height };
  return rigRect;
}

function updateCamera() {
  const { left, top, width, height } = rigRect || measureRig();

  camera.aspect = width / height;

  // the distance at which a box of the rig's half extents fits both axes
  const vFov = THREE.MathUtils.degToRad(camera.fov);
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
  const distance = Math.max(rig.extent.y / Math.tan(vFov / 2), rig.extent.x / Math.tan(hFov / 2)) * FIT_MARGIN + rig.extent.z;
  camera.position.set(0, rig.bobY, distance * rig.radius * rig.fit);

  camera.setViewOffset(width, height, window.scrollX - left, window.scrollY - top, window.innerWidth, window.innerHeight);
}

// -1 until the sim is up
let current = -1;
let beforeMark = START_ATTRACTOR;
// set by the first press of a shape button, the cycle never takes over again
let manual = false;
let cycling = false;
let morphTween = null;
let cycleCall = null;
const buttons = [];

function initShapeSwitch() {
  const list = document.querySelector('.attractor-switch');

  ATTRACTORS.forEach((name, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'attractor-option';
    button.textContent = name;
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => {
      manual = true;
      stopCycle();
      applyShape(index);
    });
    list.appendChild(button);
    buttons.push(button);
  });
}

function stopCycle() {
  cycling = false;
  cycleCall?.kill();
}

function scheduleNext() {
  cycleCall?.kill();
  if (cycling) {
    cycleCall = gsap.delayedCall(CYCLE_INTERVAL, () => applyShape((current + 1) % ATTRACTORS.length));
  }
}

export function resumeCycle() {
  if (!manual) {
    cycling = true;
    scheduleNext();
  }
}

export function lockAttractor() {
  pictureToken++;
  stopCycle();
  applyShape(PROJECT_ATTRACTOR);
}

function applyShape(index) {
  if (!simMaterial) {
    current = index;
    syncButtons();
    return;
  }

  // already there, but the cycle still wants arming
  if (index === current) {
    scheduleNext();
    return;
  }

  const uniforms = simMaterial.uniforms;
  // a mark is a texture, so there is nothing to morph from
  const fromMark = current === MARK;
  current = index;
  syncButtons();

  uniforms.attractorFrom.value = fromMark ? index
    : uniforms.morph.value < 0.5 ? uniforms.attractorFrom.value : uniforms.attractorTo.value;
  uniforms.attractorTo.value = index;
  uniforms.state.value = 1;

  morphTween?.kill();
  uniforms.morph.value = 0;
  morphTween = gsap.to(uniforms.morph, { value: 1, duration: MORPH_DURATION, ease: 'none' });

  tweenFraming({ x: 1, y: 1, z: 1 }, 1);
  scheduleNext();
}

// overwrite auto so a press part way through a transition takes these over
function tweenFraming(extent, colourMix) {
  const tween = { duration: MORPH_DURATION, ease: 'power2.inOut', overwrite: 'auto' };
  gsap.to(rig, { radius: RADIUS, ...tween });
  gsap.to(rig.extent, { ...extent, ...tween });
  gsap.to(pointMaterial.uniforms.colourMix, { value: colourMix, ...tween, ease: 'none' });
}

function syncButtons() {
  buttons.forEach((button, index) => button.setAttribute('aria-pressed', String(index === current)));
}

// a picture becomes a particle target: rasterise it to an alpha mask, then one
// gpu pass gives each particle a cell of a grid over the mask

let markMaterial, markScene;
let markTargets = [];
let nextMarkTarget = 0;
// building a mark is async, so only the newest request reaches the cloud
let pictureToken = 0;

function initMarks(side) {
  markMaterial = new THREE.ShaderMaterial({
    uniforms: {
      mask: { value: null },
      maskMin: { value: new THREE.Vector2() },
      maskMax: { value: new THREE.Vector2() },
      fallback: { value: new THREE.Vector2() },
      extent: { value: new THREE.Vector2() },
      lattice: { value: new THREE.Vector2() },
      simSide: { value: side },
      depth: { value: RADIUS * MARK_DEPTH },
      tint: { value: new THREE.Color() },
    },
    vertexShader: quadVert,
    fragmentShader: markFrag,
  });
  markScene = quadScene(markMaterial);

  // a crossfade reads two targets, so the next mark needs a third
  markTargets = [floatTarget(side), floatTarget(side), floatTarget(side)];
}

export async function showPicture(url, accent = '#ffffff') {
  const token = ++pictureToken;
  const mark = await buildMark(url, accent);

  if (!mark || token !== pictureToken) {
    return;
  }

  stopCycle();
  morphTween?.kill();
  beforeMark = current === MARK ? beforeMark : current;
  current = MARK;
  syncButtons();

  simMaterial.uniforms.state.value = 0;
  // a mark's colours are its own
  setCloudTarget(mark.texture, 0);
  tweenFraming(mark.extent, 0);
}

export function clearPicture() {
  pictureToken++;
  if (current === MARK) {
    applyShape(beforeMark);
  }
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`could not load ${url}`));
    image.src = url;
  });
}

// opaque bounding box and first opaque pixel
function measureMask(pixels) {
  let minX = MASK_SIDE;
  let maxX = -1;
  let minY = -1;
  let maxY = -1;
  let firstX = 0;

  for (let y = 0; y < MASK_SIDE; y++) {
    const row = y * MASK_SIDE * 4;

    let left = 0;
    while (left < MASK_SIDE && pixels[row + left * 4 + 3] <= 127) left++;
    if (left === MASK_SIDE) {
      continue;
    }

    let right = MASK_SIDE - 1;
    while (pixels[row + right * 4 + 3] <= 127) right--;

    if (minY < 0) {
      minY = y;
      firstX = left;
    }
    minX = Math.min(minX, left);
    maxX = Math.max(maxX, right);
    maxY = y;
  }

  if (minY < 0) {
    return null;
  }

  // half a texel in so a nearest sample cannot fall outside
  const uv = (x, y) => new THREE.Vector2((x + 0.5) / MASK_SIDE, (y + 0.5) / MASK_SIDE);
  return {
    min: uv(minX, minY),
    max: uv(maxX, maxY),
    fallback: uv(firstX, minY),
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

async function buildMark(url, accent) {
  if (!markMaterial) {
    return null;
  }

  const image = await loadImage(url);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = MASK_SIDE;
  const context = canvas.getContext('2d', { willReadFrequently: true });

  // contained so a source that is not square keeps its shape
  const scale = Math.min(MASK_SIDE / image.width, MASK_SIDE / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  context.drawImage(image, (MASK_SIDE - width) / 2, (MASK_SIDE - height) / 2, width, height);

  const mask = measureMask(context.getImageData(0, 0, MASK_SIDE, MASK_SIDE).data);
  if (!mask) {
    throw new Error(`${url} rasterised to nothing`);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  // measureMask reads top row first
  texture.flipY = false;

  const longest = Math.max(mask.width, mask.height);
  const extent = { x: mask.width / longest, y: mask.height / longest, z: MARK_DEPTH };

  // as many grid cells as there are particles, in the shape of the picture
  const aspect = mask.width / mask.height;
  const columns = Math.max(1, Math.floor(Math.sqrt(particleTotal * aspect)));
  const rows = Math.max(1, Math.floor(columns / aspect));

  const uniforms = markMaterial.uniforms;
  uniforms.mask.value = texture;
  uniforms.maskMin.value.copy(mask.min);
  uniforms.maskMax.value.copy(mask.max);
  uniforms.fallback.value.copy(mask.fallback);
  uniforms.extent.value.set(extent.x * RADIUS, extent.y * RADIUS);
  uniforms.lattice.value.set(columns, rows);
  uniforms.tint.value.setStyle(accent, THREE.NoColorSpace);

  const target = markTargets[nextMarkTarget];
  nextMarkTarget = (nextMarkTarget + 1) % markTargets.length;
  renderer.setRenderTarget(target);
  renderer.render(markScene, quadCamera);
  renderer.setRenderTarget(null);
  texture.dispose();

  return { texture: target.texture, extent };
}
