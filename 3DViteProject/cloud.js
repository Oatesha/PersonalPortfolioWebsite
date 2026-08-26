import * as THREE from 'three';
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';
import { GLTFLoader } from 'three/examples/jsm/Addons.js';
import gsap from 'gsap';
import { getGPUTier } from 'detect-gpu';
import { simVert, cloudSimFrag, cloudPointVert, cloudPointFrag } from './shaders.js';
import { initMarks } from './marks.js';

// the one cloud, drawn to a fixed fullscreen canvas. a project picture is a
// target it marches to, not a second renderer

const MAX_PIXEL_RATIO = 2;

// 60Hz frames of sim per real frame
const SIM_SPEED = 2.4;

// side of the sim texture, so the ceiling on particle count. every texel steps
// every frame whether or not it is drawn
const DESKTOP_TEXTURE_SIDE = 1280;
const MOBILE_TEXTURE_SIDE = 256;

const PARTICLE_STEPS = [25000, 50000, 100000, 250000, 500000, 750000, 1000000];

const TARGET_CROSSFADE = 1.2;

// https://stackoverflow.com/questions/11381673/detecting-a-mobile-browser
function detectMob() {
  const toMatch = [
      /Android/i,
      /webOS/i,
      /iPhone/i,
      /iPad/i,
      /iPod/i,
      /BlackBerry/i,
      /Windows Phone/i
  ];

  return toMatch.some((toMatchItem) => {
      return navigator.userAgent.match(toMatchItem);
  });
}

export const mobile = detectMob();

const camera = new THREE.PerspectiveCamera(50, window.innerWidth/window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({alpha: true});
const simScene = new THREE.Scene();
const clock = new THREE.Clock();

const pointer = new THREE.Vector2();
const raycaster = new THREE.Raycaster();

let pointerActive = false;

let renderMaterial, simMaterial, modelMesh, renderTargetA, renderTargetB, fbo;

let particleGeometry = null;
let particleTotal = 0;
let defaultParticleCount = 250000;
let pointSize = 0;

// which slot the cloud reads. the other is free to write
let activeTargetSlot = 0;
let activeTargetTexture = null;
let targetTween = null;

let onCloudReady = null;
let unsupported = false;

// three only promotes ShaderMaterial to glsl 3 on webgl2, and the point shader
// unpacks colour with bitwise ops
function cloudSupported() {
  return renderer.capabilities.isWebGL2
    && renderer.capabilities.floatVertexTextures
    && renderer.extensions.has('EXT_color_buffer_float');
}

export function initCloud(onReady) {
  onCloudReady = onReady;
  pointSize = getDefaultPointSize();

  if (!cloudSupported()) {
    console.warn('No WebGL2 float render targets here, the cloud will not run');
    unsupported = true;
    // the page still works, it just has no cloud in it
    onCloudReady?.();
    return;
  }

  renderer.setPixelRatio(currentPixelRatio());
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.domElement.id = 'threeJSCanvas';
  renderer.setClearColor(0x000000, 0);
  document.body.appendChild(renderer.domElement);

  initRig();
  initShapeSwitch();
  setRigTarget(document.querySelector('.LandingStage'));

  document.addEventListener('pointermove', onPointerMove);
  // otherwise the dent freezes into the cloud
  document.addEventListener('pointerleave', releasePointer);
  window.addEventListener('blur', releasePointer);
  window.addEventListener('resize', requestResize, false);

  loadModelGeometry();
}

export function cloudReady() {
  return Boolean(renderMaterial && particleTotal);
}

export function cloudUnsupported() {
  return unsupported;
}

function currentPixelRatio() {
  return Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO);
}

// gl_PointSize is in device pixels and the grid puts particles about one apart
// on a retina display, so a 1x display has four times the cell to cover
export function getDefaultPointSize() {
  return currentPixelRatio() >= 2 ? 1.0 : 1.5;
}

function onPointerMove(event) {
  pointerActive = true;

  pointer.x = ( event.clientX / window.innerWidth ) * 2 - 1;
  pointer.y = - ( event.clientY / window.innerHeight ) * 2 + 1;
}

function releasePointer() {
  pointerActive = false;
}

// onWindowResize reads layout, so coalesce bursts into one per frame
let resizePending = false;

function requestResize() {
  if (resizePending) {
    return;
  }
  resizePending = true;
  requestAnimationFrame(() => {
    resizePending = false;
    renderer.setPixelRatio(currentPixelRatio());
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

function loadModelGeometry() {
  const modelLoader = new GLTFLoader();
  modelLoader.load('models/radiant_pillar_baked.glb', function (gltf) {
    gltf.scene.traverse((child) => {
      if (child.isMesh) {
        modelMesh = child.clone();
        modelMesh.geometry = child.geometry.clone();
        modelMesh.geometry.center()
        modelMesh.geometry.scale(0.085, 0.085, 0.085);

        // the sphere sets the scale the animations tween. the box gives the
        // silhouette the rig frames against
        modelMesh.geometry.computeBoundingSphere();
        modelMesh.geometry.computeBoundingBox();
        const { radius } = modelMesh.geometry.boundingSphere;
        const halfExtent = modelMesh.geometry.boundingBox.getSize(new THREE.Vector3()).multiplyScalar(0.5);
        rig.radius = radius;
        // mutated not replaced. tweens write to this object
        rig.extent.x = halfExtent.x / radius;
        rig.extent.y = halfExtent.y / radius;
        rig.extent.z = halfExtent.z / radius;
      }
    });

    initFBO();
  }, undefined, function (error) {
    console.error(error);
  });
}

// every particle drawn is a cell of the grid a scene is laid on, so short of
// the total is holes in it
function defaultCountForTier(tier, total) {
  if (tier >= 2) return total;
  if (tier === 1) return 1000000;
  return 250000;
}

// one point per particle spread over the model's surface by area
function samplePositions(numSamples, mesh) {
  let positions = [];
  const sampler = new MeshSurfaceSampler(mesh).build();

  for (let i = 0; i < numSamples; i++) {
    let position = new THREE.Vector4();
    let normals = new THREE.Vector3();
    let colour = new THREE.Vector3();

    sampler.sample(position, normals, colour);

    // colour packed into w so one RGBA texture carries both
    let r = Math.round(gsap.utils.clamp(0, 255, colour.r * 255));
    let g = Math.round(gsap.utils.clamp(0, 255, colour.g * 255));
    let b = Math.round(gsap.utils.clamp(0, 255, colour.b * 255));

    let packedRGB = (r << 16) | (g << 8) | b;
    position.w = packedRGB;
    positions.push(position);
  }
  return positions;
}

async function initFBO() {
  let gputier = await getGPUTier();
  let w = mobile ? MOBILE_TEXTURE_SIDE : DESKTOP_TEXTURE_SIDE;
  let h = w;
  defaultParticleCount = defaultCountForTier(gputier.tier, w * h);

  // scattered so the model assembles itself on load
  let initPos = new Float32Array(w * h * 4);
  for (let i = 0; i < w; i++) {
    for (let j = 0; j < h; j++) {
      const index = (i + j * w) * 4;

      const distance = Math.sqrt(Math.random()) * 20.0;
      const theta = THREE.MathUtils.randFloatSpread(360);
      const phi = THREE.MathUtils.randFloatSpread(360);
      initPos[index] = distance * Math.sin(theta) * Math.cos(phi);
      initPos[index + 1] = distance * Math.sin(theta) * Math.sin(phi);
      initPos[index + 2] = distance * Math.cos(theta);
      initPos[index + 3] = 1.0;
    }
  }

  const numInitialPositions = w * h;

  let initialPositions = samplePositions(numInitialPositions, modelMesh);
  let initialPositionsArray = new Float32Array(numInitialPositions * 4);
  initialPositions.forEach((position, index) => {
    initialPositionsArray[index * 4] = position.x;
    initialPositionsArray[index * 4 + 1] = position.y;
    initialPositionsArray[index * 4 + 2] = position.z;
    initialPositionsArray[index * 4 + 3] = position.w;
  });

  let scatteredTex = new THREE.DataTexture(initPos, w, h, THREE.RGBAFormat, THREE.FloatType);
  let modelTex = new THREE.DataTexture(initialPositionsArray, w, h, THREE.RGBAFormat, THREE.FloatType);

  // a DataTexture sits at version 0 until this is set, and three uploads nothing
  scatteredTex.minFilter = THREE.NearestFilter;
  scatteredTex.magFilter = THREE.NearestFilter;
  scatteredTex.needsUpdate = true;

  modelTex.minFilter = THREE.NearestFilter;
  modelTex.magFilter = THREE.NearestFilter;
  modelTex.needsUpdate = true;

  // state 0 pulls every particle to its point on the target. state 1 runs an
  // attractor
  simMaterial = new THREE.ShaderMaterial({
    uniforms: {
      state: { value: 0 },
      dtScale: {value: 1.0},
      // idle sits at morph 1, fully arrived at attractorTo
      attractorFrom: {value: 0},
      attractorTo: {value: 0},
      morph: {value: 1.0},
      cloudRadius: {value: 1.0},
      posTex: { value: scatteredTex },
      targetTexA: { value: modelTex },
      targetTexB: { value: modelTex },
      targetMix: { value: 0 },
      mouseOrigin: { value: new THREE.Vector3() },
      mouseDir: { value: new THREE.Vector3(0, 0, -1) },
      mouseActive: { value: 0.0 },
    },
    vertexShader: simVert,
    fragmentShader: cloudSimFrag,
  });

  class FBO {
    constructor(w, simMat) {
      this.scene = new THREE.Scene();
      this.camera = new THREE.OrthographicCamera(-w / 2, w / 2, w / 2, -w / 2, -1, 1);
      var planeGeometry = new THREE.PlaneGeometry(w, w);
      var planeMesh = new THREE.Mesh(planeGeometry, simMat);
      this.scene.add(planeMesh);
    }
  }

  fbo = new FBO(w, simMaterial);

  initMarks(renderer, w);

  renderTargetA = new THREE.WebGLRenderTarget(w, h, {
    wrapS: THREE.RepeatWrapping,
    wrapT: THREE.RepeatWrapping,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    format: THREE.RGBAFormat,
    type: THREE.FloatType,
    stencilBuffer: false,
  });

  // a target cannot be read and written in one pass, so state alternates
  // between this pair every frame
  renderTargetB = renderTargetA.clone();

  renderer.setRenderTarget(renderTargetA);
  renderer.clear();
  renderer.render(fbo.scene, fbo.camera);
  renderer.setRenderTarget(renderTargetB);
  renderer.clear();
  renderer.render(fbo.scene, fbo.camera);
  renderer.setRenderTarget(null);

  activeTargetTexture = modelTex;

  renderMaterial = new THREE.ShaderMaterial({
    uniforms: {
      posTex: { value: modelTex },
      targetTexA: { value: modelTex },
      targetTexB: { value: modelTex },
      targetMix: { value: 0 },
      pointSize: { value: pointSize },
      colourMix: { value: 0.0 },
      // filled in by applyPalette. only the type matters here
      rampLow: { value: new THREE.Vector3() },
      rampMid: { value: new THREE.Vector3() },
      rampHigh: { value: new THREE.Vector3() },
      baseGain: { value: new THREE.Vector3(1, 1, 1) },
      baseDesaturate: { value: 0 },
      baseTint: { value: new THREE.Vector3(1, 1, 1) },
      gradeA: { value: 1 },
      gradeB: { value: 1 },
    },
    vertexShader: cloudPointVert,
    fragmentShader: cloudPointFrag,
  });

  applyPalette();

  particleGeometry = new THREE.BufferGeometry();
  let positions = new Float32Array((w * w) * 3);
  let uvs = new Float32Array((w * w) * 2);

  // the count slider draws a prefix of this buffer, and a scene's sampler ties
  // texel index to position, so in texel order a prefix cuts a band out of the
  // picture rather than thinning it. shuffled once, any prefix is a fair sample
  const order = new Uint32Array(w * w);
  for (let index = 0; index < order.length; index++) {
    order[index] = index;
  }
  for (let index = order.length - 1; index > 0; index--) {
    const swap = Math.floor(Math.random() * (index + 1));
    const held = order[index];
    order[index] = order[swap];
    order[swap] = held;
  }

  // a particle's "position" is the sim texel it reads. texel centres so
  // NearestFilter cannot land on a boundary
  for (let index = 0; index < order.length; index++) {
    const texel = order[index];
    const i = texel % w;
    const j = (texel - i) / w;

    positions[index * 3] = (i + 0.5) / w;
    positions[index * 3 + 1] = (j + 0.5) / w;
    positions[index * 3 + 2] = 0.0;
    uvs[index * 2] = (i + 0.5) / w;
    uvs[index * 2 + 1] = (j + 0.5) / w;
  }

  particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  particleGeometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  particleTotal = w * w;

  simScene.add(new THREE.Points(particleGeometry, renderMaterial));

  // on gsap's ticker so everything shares one clock
  gsap.ticker.add(render);
  onCloudReady?.();
}

function render() {
  // a backgrounded tab still gets throttled frames on some browsers
  if (document.hidden) {
    return;
  }

  // capped so a dropped frame cannot blow up the attractor
  const frameScale = Math.min(clock.getDelta() * 60, 2);
  simMaterial.uniforms.dtScale.value = frameScale * SIM_SPEED;
  simMaterial.uniforms.cloudRadius.value = rig.radius;

  updateCameraFraming();

  // ping pong. read A, write B, then draw from B
  var temp = renderTargetA;
  renderTargetA = renderTargetB;
  renderTargetB = temp;
  simMaterial.uniforms.posTex.value = renderTargetA.texture;
  renderer.setRenderTarget(renderTargetB);
  renderer.render(fbo.scene, fbo.camera);
  renderer.setRenderTarget(null);
  renderMaterial.uniforms.posTex.value = renderTargetB.texture;

  renderer.render(simScene, camera);

  // after the render so the view offset is already in the projection
  raycaster.setFromCamera(pointer, camera);
  simMaterial.uniforms.mouseOrigin.value.copy(raycaster.ray.origin);
  simMaterial.uniforms.mouseDir.value.copy(raycaster.ray.direction);
  simMaterial.uniforms.mouseActive.value = pointerActive ? 1.0 : 0.0;
}

// the slider's stops clamped to what this device's texture can supply
export function getParticleSteps() {
  const steps = PARTICLE_STEPS.filter((count) => count <= particleTotal);
  if (!steps.length || steps[steps.length - 1] < particleTotal * 0.9) {
    steps.push(particleTotal);
  }
  return steps;
}

export function getDefaultParticleCount() {
  return defaultParticleCount;
}

// draws a prefix of the particle buffer, which initFBO shuffled so any prefix
// is spread evenly over the sim texture
export function setParticleCount(count) {
  if (!particleGeometry) {
    return 0;
  }
  const drawn = Math.max(1, Math.min(Math.round(count), particleTotal));
  particleGeometry.setDrawRange(0, drawn);
  return drawn;
}

export function setPointSize(size) {
  pointSize = size;
  if (renderMaterial) {
    renderMaterial.uniforms.pointSize.value = size;
  }
}

// writes a target into the slot the cloud is not reading, then crossfades onto
// it. graded 1 where the colours are the model's own and want the page palette
function setCloudTarget(texture, { duration = TARGET_CROSSFADE, graded = 1 } = {}) {
  if (!simMaterial || !renderMaterial || !texture || texture === activeTargetTexture) {
    return;
  }

  activeTargetTexture = texture;

  const free = activeTargetSlot === 0 ? 'B' : 'A';
  simMaterial.uniforms[`targetTex${free}`].value = texture;
  renderMaterial.uniforms[`targetTex${free}`].value = texture;
  renderMaterial.uniforms[`grade${free}`].value = graded;

  activeTargetSlot = activeTargetSlot === 0 ? 1 : 0;

  targetTween?.kill();
  targetTween = gsap.to([simMaterial.uniforms.targetMix, renderMaterial.uniforms.targetMix], {
    value: activeTargetSlot,
    duration,
    ease: 'power2.inOut',
    overwrite: 'auto',
  });
}

// the palette lives in style.css and reaches the cloud through page.js. it can
// land before there is a material to paint
const palette = {};

export function setCloudPalette(next) {
  Object.assign(palette, next);
  applyPalette();
}

function applyPalette() {
  if (!renderMaterial) {
    return;
  }

  ['rampLow', 'rampMid', 'rampHigh', 'baseTint'].forEach((uniform) => {
    if (palette[uniform]) {
      renderMaterial.uniforms[uniform].value.set(...palette[uniform]);
    }
  });

  if (Number.isFinite(palette.gain)) {
    renderMaterial.uniforms.baseGain.value.setScalar(palette.gain);
  }

  if (Number.isFinite(palette.desaturate)) {
    renderMaterial.uniforms.baseDesaturate.value = palette.desaturate;
  }
}

// frames the model inside a DOM element while the canvas stays fixed and
// fullscreen. setViewOffset runs backwards: the base frustum is the target box
// and the sub rect asked for is the viewport in box coordinates, so the frustum
// widens outwards and the box stays where the DOM put it

export const rig = {
  // element to centre the model in. null means the whole viewport
  target: null,
  radius: 1,
  // half extents as multiples of radius
  extent: { x: 1, y: 1, z: 1 },
  // fraction of the fitted distance to sit at. below 1 moves in, negative
  // passes through the model
  fit: 1,
  margin: 1.05,
  bobY: 0,
};

let cachedRect = null;
let cachedTarget = null;
let resizeObserver = null;

export function invalidateRigRect() {
  cachedRect = null;
}

export function setRigTarget(element) {
  if (rig.target === element) {
    return;
  }
  rig.target = element;
  invalidateRigRect();
}

function initRig() {
  // getBoundingClientRect forces layout and gsap writes transforms every frame
  // during a project transition. only read it when something has changed
  resizeObserver = new ResizeObserver(invalidateRigRect);
  window.addEventListener('resize', invalidateRigRect);
  window.addEventListener('scroll', invalidateRigRect, { passive: true });
}

function viewportRect() {
  return { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
}

function targetRect() {
  if (rig.target !== cachedTarget) {
    if (resizeObserver) {
      if (cachedTarget) {
        resizeObserver.unobserve(cachedTarget);
      }
      if (rig.target) {
        resizeObserver.observe(rig.target);
      }
    }
    cachedTarget = rig.target;
    cachedRect = null;
  }

  if (cachedRect) {
    return cachedRect;
  }

  if (!rig.target) {
    cachedRect = viewportRect();
    return cachedRect;
  }

  const rect = rig.target.getBoundingClientRect();

  // a hidden or not yet laid out target gives a degenerate frustum
  if (rect.width < 1 || rect.height < 1) {
    return viewportRect();
  }

  cachedRect = rect;
  return cachedRect;
}

// distance at which a box of these half extents fits the frustum on both axes.
// a box rather than a sphere because the model is flat, so the fit is against
// the near face with the depth added back
function fitDistance(radius, extent, margin) {
  const vFov = THREE.MathUtils.degToRad(camera.fov);
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
  const distV = (radius * extent.y) / Math.tan(vFov / 2);
  const distH = (radius * extent.x) / Math.tan(hFov / 2);
  return Math.max(distV, distH) * margin + radius * extent.z;
}

function updateCameraFraming() {
  const rect = targetRect();

  // fitDistance reads camera.aspect, so set it before working out the distance
  camera.aspect = rect.width / rect.height;

  camera.position.set(0, rig.bobY, fitDistance(rig.radius, rig.extent, rig.margin) * rig.fit);

  camera.setViewOffset(rect.width, rect.height, -rect.left, -rect.top, window.innerWidth, window.innerHeight);
}

// order and indices must match the constants in shaders.js
const ATTRACTORS = ["Thomas", "Lorenz", "Rössler", "Halvorsen", "Dadras"];

// not an attractor. state 0, pulling to a target texture
const MARK = -2;

const PROJECT_ATTRACTOR = 4;

// the shape the landing settles on once the intro is done
const START_ATTRACTOR = 1;
const CYCLE_INTERVAL = 10;
// the burst is a half sine over this, so the cloud is most scattered halfway
const MORPH_DURATION = 2.4;

const ATTRACTOR_RADIUS = 4;

// nothing is applied until the sim is up
let current = -1;
// what to fall back to when a mark is dropped
let beforeMark = START_ATTRACTOR;
// set by the first press of a shape button. the cycle never takes over again
let manual = false;
let cycling = false;
let morphTween = null;
let cycleCall = null;
const buttons = [];

export function startAttractorMode() {
  if (manual) {
    return;
  }
  cycling = true;
  applyShape(START_ATTRACTOR);
}

function selectShape(index) {
  manual = true;
  cycling = false;
  cycleCall?.kill();
  cycleCall = null;
  applyShape(index);
}

// pins the cloud for the project panel and stops the clock
export function lockAttractor(index = PROJECT_ATTRACTOR) {
  cycling = false;
  cycleCall?.kill();
  cycleCall = null;
  applyShape(index);
}

// hands the cloud to a mark and stops the clock
export function showMark(texture, framing) {
  if (!simMaterial || !renderMaterial) {
    return;
  }

  cycling = false;
  cycleCall?.kill();
  cycleCall = null;
  morphTween?.kill();

  beforeMark = current === MARK ? beforeMark : current;
  current = MARK;
  syncButtons();

  simMaterial.uniforms.state.value = 0;
  // a mark's colours are its own, so they are left as sampled
  setCloudTarget(texture, { graded: 0 });
  tweenFraming(framing.radius, framing.extent, 0);
}

export function clearMark() {
  if (current !== MARK) {
    return;
  }

  applyShape(beforeMark);
}

export function resumeCycle() {
  // someone who picked a shape by hand keeps it
  if (manual) {
    return;
  }
  cycling = true;
  scheduleNext();
}

function advance() {
  cycling = true;
  applyShape((current + 1) % ATTRACTORS.length);
}

function applyShape(index) {
  // the buttons exist from first paint. the sim does not
  if (!simMaterial || !renderMaterial) {
    return;
  }

  // already there, but the cycle still wants arming
  if (index === current) {
    scheduleNext();
    return;
  }

  // a mark is a target texture, not a field, so there is nothing to morph from
  const fromTarget = current === MARK;
  current = index;
  syncButtons();

  simMaterial.uniforms.attractorFrom.value = fromTarget
    ? index
    : (simMaterial.uniforms.morph.value < 0.5
        ? simMaterial.uniforms.attractorFrom.value
        : simMaterial.uniforms.attractorTo.value);
  simMaterial.uniforms.attractorTo.value = index;
  simMaterial.uniforms.state.value = 1;

  morphTween?.kill();
  simMaterial.uniforms.morph.value = 0;
  morphTween = gsap.to(simMaterial.uniforms.morph, {
    value: 1,
    duration: MORPH_DURATION,
    ease: "none",
  });

  tweenFraming(ATTRACTOR_RADIUS, { x: 1, y: 1, z: 1 }, 1);
  scheduleNext();
}

// overwrite auto throughout so a press part way through a transition takes
// these over rather than fighting the tween on them
function tweenFraming(radius, extent, colourMix) {
  gsap.to(rig, { radius, duration: MORPH_DURATION, ease: "power2.inOut", overwrite: "auto" });
  gsap.to(rig.extent, { ...extent, duration: MORPH_DURATION, ease: "power2.inOut", overwrite: "auto" });
  // baked colours on the hull, speed on an attractor
  gsap.to(renderMaterial.uniforms.colourMix, { value: colourMix, duration: MORPH_DURATION, ease: "none", overwrite: "auto" });
}

function scheduleNext() {
  cycleCall?.kill();
  if (!cycling) {
    cycleCall = null;
    return;
  }
  cycleCall = gsap.delayedCall(CYCLE_INTERVAL, advance);
}

function syncButtons() {
  buttons.forEach((button, position) => {
    button.setAttribute("aria-pressed", String(position === current));
  });
}

function initShapeSwitch() {
  const list = document.querySelector(".attractor-switch");
  if (!list) {
    return;
  }

  ATTRACTORS.forEach((name, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "attractor-option";
    button.textContent = name;
    button.setAttribute("aria-pressed", String(index === current));
    button.addEventListener("click", () => selectShape(index));
    list.appendChild(button);
    buttons.push(button);
  });

  list.setAttribute("aria-label", "Shape");
}
