import * as THREE from 'three';
import gsap from 'gsap';
import { quadVert, simFrag, pointVert, pointFrag, markFrag, copyFrag } from './shaders.js';

const MAX_PIXEL_RATIO = 2;

// Simulation steps per frame at 60 Hz.
const SIM_SPEED = 2.4;

// Width and height of the simulation texture. Each texel is one particle, so
// this sets the particle count. The sim starts at the first and steps down
// while frames run slow.
const TEXTURE_SIDES = [1280, 1024, 768, 512, 384, 256];
const MOBILE_TEXTURE_SIDE = 256;

// Median frame time that triggers a step down. A step aims for 60 fps,
// assuming frame time scales with particle count.
const FRAME_BUDGET_MS = 22;
const TARGET_FRAME_MS = 1000 / 60;
// Skipped after startup and each step, for shader compiles and uploads.
const WARMUP_FRAMES = 10;
const SAMPLE_FRAMES = 20;

const PARTICLE_STEPS = [25000, 50000, 100000, 250000, 500000, 750000, 1000000];

// Must match WORLD_RADIUS in shaders.js.
const RADIUS = 4;

// The camera starts this far out and zooms in on load.
const INTRO_RADIUS = 24;

const FIT_MARGIN = 1.05;
const TARGET_CROSSFADE = 1.2;
const MORPH_DURATION = 2.4;
const CYCLE_INTERVAL = 10;

// Order must match the attractor constants in shaders.js.
const ATTRACTORS = ['Thomas', 'Lorenz', 'Rössler', 'Halvorsen', 'Dadras'];
const START_ATTRACTOR = 1;
const PROJECT_ATTRACTOR = 4;
const MARK = -2;

const MASK_SIDE = 1024;
const MARK_DEPTH = 0.04;

// Passed to the shaders as written, without three.js's sRGB conversion.
const PALETTES = {
  light: { low: 0x8f8c86, mid: 0xc2551a, high: 0x1a1917, tint: 0xffe2cd, gain: 0.42, desaturate: 0.92 },
  dark: { low: 0x4a2311, mid: 0xff8a3c, high: 0xf7f3ef, tint: 0xffcfae, gain: 0.95, desaturate: 0.88 },
};

export const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|Windows Phone/i.test(navigator.userAgent);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
// Created in initCloud, since the constructor throws without WebGL.
let renderer = null;
const scene = new THREE.Scene();
const clock = new THREE.Clock();
const pointer = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
let pointerActive = false;

const quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1);

let simMaterial, pointMaterial, copyMaterial, simScene, copyScene, readTarget, writeTarget;
let points = null;
let side = 0;
let particleTotal = 0;
let onRescale = null;
let theme = 'dark';

export const rig = {
  target: null,
  radius: INTRO_RADIUS,
  // Half extents of the framed volume, as multiples of radius.
  extent: { x: 1, y: 1, z: 1 },
  // Camera distance as a fraction of the distance that fits the cloud in frame.
  // Values at or below zero put the camera inside the cloud.
  fit: 1,
  bobY: 0,
};

// The simulation renders into float targets, and the point shader unpacks colour
// with bitwise ops, which needs GLSL 3. three.js only compiles ShaderMaterial as
// GLSL 3 on WebGL2.
function supported() {
  return renderer.capabilities.isWebGL2
    && renderer.capabilities.floatVertexTextures
    && renderer.extensions.has('EXT_color_buffer_float');
}

// onRescaled runs after the sim steps down to a smaller texture.
export function initCloud(onReady, onRescaled) {
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true });
  } catch {
    renderer = null;
  }

  if (!renderer || !supported()) {
    console.warn('no webgl2 float render targets, the cloud will not run');
    renderer?.dispose();
    renderer = null;
    onReady(false);
    return;
  }

  onRescale = onRescaled;
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
  // Otherwise the dent the cursor pushes into the cloud stays after it leaves.
  document.addEventListener('pointerleave', () => (pointerActive = false));
  window.addEventListener('blur', () => (pointerActive = false));
  window.addEventListener('resize', () => {
    renderer.setPixelRatio(pixelRatio());
    renderer.setSize(window.innerWidth, window.innerHeight);
    rigRect = null;
  });

  initSim();
  onReady(true);
}

function pixelRatio() {
  return Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO);
}

// gl_PointSize is in device pixels, so points need to be larger on 1x displays
// to fill the same space.
export function defaultPointSize() {
  return pixelRatio() >= 2 ? 1.0 : 1.5;
}

function floatTexture(data, side) {
  const texture = new THREE.DataTexture(data, side, side, THREE.RGBAFormat, THREE.FloatType);
  // three.js doesn't upload a DataTexture until this is set.
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

function scatterTexture() {
  const scattered = new Float32Array(particleTotal * 4);
  for (let i = 0; i < particleTotal; i++) {
    const distance = Math.sqrt(Math.random()) * 20.0;
    const theta = THREE.MathUtils.randFloatSpread(360);
    const phi = THREE.MathUtils.randFloatSpread(360);
    scattered[i * 4] = distance * Math.sin(theta) * Math.cos(phi);
    scattered[i * 4 + 1] = distance * Math.sin(theta) * Math.sin(phi);
    scattered[i * 4 + 2] = distance * Math.cos(theta);
    // Colour is packed into alpha as 0xRRGGBB. White grades to the theme tint.
    scattered[i * 4 + 3] = 0xffffff;
  }
  return floatTexture(scattered, side);
}

function initSim() {
  simMaterial = new THREE.ShaderMaterial({
    uniforms: {
      // 0 moves each particle to its point on the target, 1 runs an attractor.
      state: { value: 0 },
      dtScale: { value: 1 },
      attractorFrom: { value: 0 },
      attractorTo: { value: 0 },
      morph: { value: 1 },
      posTex: { value: null },
      targetTexA: { value: null },
      targetTexB: { value: null },
      targetMix: { value: 0 },
      mouseOrigin: { value: new THREE.Vector3() },
      mouseDir: { value: new THREE.Vector3(0, 0, -1) },
      mouseActive: { value: 0 },
    },
    vertexShader: quadVert,
    fragmentShader: simFrag,
  });
  simScene = quadScene(simMaterial);

  copyMaterial = new THREE.ShaderMaterial({
    uniforms: { source: { value: null } },
    vertexShader: quadVert,
    fragmentShader: copyFrag,
  });
  copyScene = quadScene(copyMaterial);

  pointMaterial = new THREE.ShaderMaterial({
    uniforms: {
      posTex: { value: null },
      targetTexA: { value: null },
      targetTexB: { value: null },
      targetMix: { value: 0 },
      pointSize: { value: defaultPointSize() },
      // 0 shows the target's own colours, 1 colours by particle speed.
      colourMix: { value: 0 },
      rampLow: { value: new THREE.Color() },
      rampMid: { value: new THREE.Color() },
      rampHigh: { value: new THREE.Color() },
      baseTint: { value: new THREE.Color() },
      baseGain: { value: 1 },
      baseDesaturate: { value: 0 },
      // 1 grades the target in that slot to the theme palette, 0 keeps its colours.
      gradeA: { value: 1 },
      gradeB: { value: 1 },
    },
    vertexShader: pointVert,
    fragmentShader: pointFrag,
  });
  applyPalette();

  points = new THREE.Points(new THREE.BufferGeometry(), pointMaterial);
  points.frustumCulled = false;
  scene.add(points);

  initMarks();
  allocateParticles(mobile ? MOBILE_TEXTURE_SIDE : TEXTURE_SIDES[0]);

  gsap.ticker.add(render);

  cycling = !manual;
  const first = manual ? current : START_ATTRACTOR;
  current = -1;
  applyShape(first);
}

function particleGeometry() {
  // The particle slider draws a prefix of this buffer. Texel order follows the
  // picture's rows, so a prefix would only cover a band of it. Shuffling makes
  // any prefix an even sample of the whole picture.
  const order = new Uint32Array(particleTotal).map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const swap = Math.floor(Math.random() * (i + 1));
    [order[i], order[swap]] = [order[swap], order[i]];
  }

  // Each vertex holds the UV of its particle's texel in the simulation texture.
  const positions = new Float32Array(particleTotal * 2);
  order.forEach((texel, i) => {
    positions[i * 2] = ((texel % side) + 0.5) / side;
    positions[i * 2 + 1] = (Math.floor(texel / side) + 0.5) / side;
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 2));
  // Set by hand: computing it from a 2D position attribute gives NaN.
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 16);
  return geometry;
}

function copyTexture(source, target) {
  copyMaterial.uniforms.source.value = source;
  renderer.setRenderTarget(target);
  renderer.render(copyScene, quadCamera);
}

// Sizes every particle texture to nextSide. On a resize, the copy pass samples
// the old textures at the new texel centres, which keeps an even subset of the
// particles where they are.
function allocateParticles(nextSide) {
  const uniforms = simMaterial.uniforms;
  const old = readTarget && {
    positions: writeTarget.texture,
    slots: [uniforms.targetTexA.value, uniforms.targetTexB.value],
    targets: [readTarget, writeTarget, ...markTargets],
  };

  side = nextSide;
  particleTotal = side * side;

  // Two targets to ping-pong between, since a pass can't read and write the
  // same texture.
  readTarget = floatTarget(side);
  writeTarget = floatTarget(side);
  // A crossfade reads two targets, so building the next mark needs a third.
  markTargets = [floatTarget(side), floatTarget(side), floatTarget(side)];

  if (old) {
    copyTexture(old.positions, readTarget);
    copyTexture(old.positions, writeTarget);
    copyTexture(old.slots[0], markTargets[0]);
    copyTexture(old.slots[1], markTargets[1]);
    old.targets.forEach((target) => target.dispose());
  } else {
    const start = scatterTexture();
    for (const target of [readTarget, writeTarget, markTargets[0], markTargets[1]]) {
      copyTexture(start, target);
    }
    start.dispose();
  }
  renderer.setRenderTarget(null);

  // Both slots hold the copies, so the crossfade carries on where it was.
  for (const material of [simMaterial, pointMaterial]) {
    material.uniforms.targetTexA.value = markTargets[0].texture;
    material.uniforms.targetTexB.value = markTargets[1].texture;
  }
  activeTarget = markTargets[activeSlot].texture;
  nextMarkTarget = 2;
  markMaterial.uniforms.simSide.value = side;

  points.geometry.dispose();
  points.geometry = particleGeometry();

  if (old) {
    // A picture's grid is laid out for the old particle count.
    if (current === MARK) {
      showPicture(pictureUrl);
    }
    onRescale?.();
  }
}

let lastFrame = 0;
let warmup = WARMUP_FRAMES;
let frameTimes = [];
let lastMedian = Infinity;
let measuring = true;

// Times frames until they fit the budget, stepping the texture down if not.
function measureFrame() {
  const now = performance.now();
  const interval = now - lastFrame;
  lastFrame = now;

  // Unfocused windows can be throttled, which would read as a slow GPU.
  if (!measuring || !document.hasFocus() || interval > 1000) {
    return;
  }
  if (warmup > 0) {
    warmup--;
    return;
  }

  frameTimes.push(interval);
  if (frameTimes.length < SAMPLE_FRAMES) {
    return;
  }

  const median = frameTimes.sort((a, b) => a - b)[frameTimes.length >> 1];
  frameTimes = [];

  const wanted = side * Math.sqrt(TARGET_FRAME_MS / median);
  const next = TEXTURE_SIDES.find((candidate) => candidate <= wanted) ?? TEXTURE_SIDES.at(-1);

  // If the last step barely helped, the frame rate is capped by the display.
  if (median <= FRAME_BUDGET_MS || next >= side || median > lastMedian * 0.85) {
    measuring = false;
    return;
  }

  lastMedian = median;
  warmup = WARMUP_FRAMES;
  allocateParticles(next);
}

function render() {
  // Some browsers keep ticking in background tabs.
  if (document.hidden) {
    return;
  }

  measureFrame();

  // Capped so a long frame can't make the integration blow up.
  simMaterial.uniforms.dtScale.value = Math.min(clock.getDelta() * 60, 2) * SIM_SPEED;

  updateCamera();

  [readTarget, writeTarget] = [writeTarget, readTarget];
  simMaterial.uniforms.posTex.value = readTarget.texture;
  renderer.setRenderTarget(writeTarget);
  renderer.render(simScene, quadCamera);
  renderer.setRenderTarget(null);
  pointMaterial.uniforms.posTex.value = writeTarget.texture;

  renderer.render(scene, camera);

  // After rendering, so the projection matrix includes this frame's view offset.
  raycaster.setFromCamera(pointer, camera);
  simMaterial.uniforms.mouseOrigin.value.copy(raycaster.ray.origin);
  simMaterial.uniforms.mouseDir.value.copy(raycaster.ray.direction);
  simMaterial.uniforms.mouseActive.value = pointerActive ? 1 : 0;
}

export function particleSteps() {
  // Ends on the total, dropping any step too close to it.
  return [...PARTICLE_STEPS.filter((count) => count < particleTotal * 0.9), particleTotal];
}

// Draws the first `count` particles of the shuffled buffer.
export function setParticleCount(count) {
  points.geometry.setDrawRange(0, count);
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

// Two target slots. A new target goes into the slot not in use, then targetMix
// crossfades over to it.
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

// The canvas covers the viewport, but the cloud is framed to fit a DOM element
// (rig.target). setViewOffset is used in reverse: the full view is the element,
// and the part rendered is the viewport.

// Cached in document coordinates, so scrolling doesn't need a fresh layout read.
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

  // Frame the viewport until the target is visible and laid out.
  if (!rect || rect.width < 1 || rect.height < 1) {
    return { left: window.scrollX, top: window.scrollY, width: window.innerWidth, height: window.innerHeight };
  }

  rigRect = { left: rect.left + window.scrollX, top: rect.top + window.scrollY, width: rect.width, height: rect.height };
  return rigRect;
}

function updateCamera() {
  const { left, top, width, height } = rigRect || measureRig();

  camera.aspect = width / height;

  // Distance at which a box with the rig's half extents fits both horizontally
  // and vertically.
  const vFov = THREE.MathUtils.degToRad(camera.fov);
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
  const distance = Math.max(rig.extent.y / Math.tan(vFov / 2), rig.extent.x / Math.tan(hFov / 2)) * FIT_MARGIN + rig.extent.z;
  camera.position.set(0, rig.bobY, distance * rig.radius * rig.fit);

  camera.setViewOffset(width, height, window.scrollX - left, window.scrollY - top, window.innerWidth, window.innerHeight);
}

// Index of the active attractor, MARK while a picture is shown, or -1 before the
// first shape is applied.
let current = -1;
let beforeMark = START_ATTRACTOR;
// Set once the user picks a shape. Auto-cycling never resumes after that.
let manual = false;
let cycling = false;
let morphTween = null;
let cycleCall = null;
const buttons = [];

function initShapeSwitch() {
  const list = document.querySelector('.AttractorSwitch');

  ATTRACTORS.forEach((name, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'AttractorOption';
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

  // Already on this shape, but the cycle timer may still need starting.
  if (index === current) {
    scheduleNext();
    return;
  }

  const uniforms = simMaterial.uniforms;
  // A picture has no attractor to morph from, so start on the new one directly.
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

// overwrite: 'auto' lets a click part way through a transition take over the
// running tweens.
function tweenFraming(extent, colourMix) {
  const tween = { duration: MORPH_DURATION, ease: 'power2.inOut', overwrite: 'auto' };
  gsap.to(rig, { radius: RADIUS, ...tween });
  gsap.to(rig.extent, { ...extent, ...tween });
  gsap.to(pointMaterial.uniforms.colourMix, { value: colourMix, ...tween, ease: 'none' });
}

function syncButtons() {
  buttons.forEach((button, index) => button.setAttribute('aria-pressed', String(index === current)));
}

// Marks turn a picture into a particle target: the image is rasterised to an
// alpha mask, then one GPU pass gives each particle a cell in a grid over it.

let markMaterial, markScene;
let markTargets = [];
let nextMarkTarget = 0;
// Building a mark is async. Each request bumps this so only the newest is shown.
let pictureToken = 0;
let pictureUrl = null;

function initMarks() {
  markMaterial = new THREE.ShaderMaterial({
    uniforms: {
      mask: { value: null },
      maskMin: { value: new THREE.Vector2() },
      maskMax: { value: new THREE.Vector2() },
      fallback: { value: new THREE.Vector2() },
      extent: { value: new THREE.Vector2() },
      lattice: { value: new THREE.Vector2() },
      simSide: { value: 0 },
      depth: { value: RADIUS * MARK_DEPTH },
      tint: { value: new THREE.Color() },
    },
    vertexShader: quadVert,
    fragmentShader: markFrag,
  });
  markScene = quadScene(markMaterial);
}

export async function showPicture(url, accent = '#ffffff') {
  const token = ++pictureToken;
  pictureUrl = url;
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
  // Keep the picture's own colours rather than grading them.
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

// Bounding box of the opaque pixels, plus the first opaque pixel.
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

  // Texel centres, so nearest sampling can't land outside the mask.
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

  // Fit inside the square canvas, keeping the aspect ratio.
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
  // measureMask's coordinates start at the top row.
  texture.flipY = false;

  const longest = Math.max(mask.width, mask.height);
  const extent = { x: mask.width / longest, y: mask.height / longest, z: MARK_DEPTH };

  // About one grid cell per particle, with the picture's aspect ratio.
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
