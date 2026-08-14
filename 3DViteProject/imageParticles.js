import * as THREE from 'three';
import gsap from 'gsap';
import { simVert } from './glsl/common.js';
import { imageSimFrag } from './glsl/imageSim.js';
import { imagePointVert, imagePointFrag } from './glsl/imagePoint.js';

// a particle carries one colour, so the grid is the resolution the screenshot
// survives at
const SIDE = 1024;

// a little sharper than the particle spacing calls for. exact is correct and
// slightly soft
const LOD_BIAS = -0.35;

// the colour handover is slower so it lands while the particles are still
// scattered
const BURST_DURATION = 0.9;
const FADE_DURATION = 1.2;

let renderer = null;
let simMaterial = null;
let pointMaterial = null;
let simScene = null;
let simCamera = null;
let targetA = null;
let targetB = null;
let points = null;

const transition = { fade: 1, burst: 0 };

let texAspect = 1;
let planeAspect = 1;

const bufferSize = new THREE.Vector2();

// stands in until the first screenshot arrives, so the previous slot is never null
function blankTexture() {
  const texture = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1, THREE.RGBAFormat);
  texture.needsUpdate = true;
  return texture;
}

function createTarget() {
  return new THREE.WebGLRenderTarget(SIDE, SIDE, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    format: THREE.RGBAFormat,
    type: THREE.FloatType,
    depthBuffer: false,
    stencilBuffer: false,
  });
}

// scattered with no velocity so the first screenshot assembles itself
function seedState() {
  const state = new Float32Array(SIDE * SIDE * 4);

  for (let i = 0; i < SIDE * SIDE; i++) {
    state[i * 4] = (Math.random() * 2 - 1) * 1.5;
    state[i * 4 + 1] = (Math.random() * 2 - 1) * 1.5;
    state[i * 4 + 2] = 0;
    state[i * 4 + 3] = 0;
  }

  const texture = new THREE.DataTexture(state, SIDE, SIDE, THREE.RGBAFormat, THREE.FloatType);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.needsUpdate = true;
  return texture;
}

// texel centres so NearestFilter cannot land on a boundary
function gridGeometry() {
  const geometry = new THREE.BufferGeometry();
  const coords = new Float32Array(SIDE * SIDE * 3);

  for (let j = 0; j < SIDE; j++) {
    for (let i = 0; i < SIDE; i++) {
      const index = (i + j * SIDE) * 3;
      coords[index] = (i + 0.5) / SIDE;
      coords[index + 1] = (j + 0.5) / SIDE;
      coords[index + 2] = 0;
    }
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(coords, 3));
  return geometry;
}

export function initImageParticles(imageRenderer, imageScene) {
  renderer = imageRenderer;

  const blank = blankTexture();

  simMaterial = new THREE.ShaderMaterial({
    uniforms: {
      posTex: { value: seedState() },
      planeAspect: { value: 1 },
      texAspect: { value: 1 },
      mouse: { value: new THREE.Vector2() },
      mouseActive: { value: 0 },
      dtScale: { value: 1 },
      burst: { value: 0 },
      gridSize: { value: SIDE },
      gridDims: { value: new THREE.Vector2(SIDE, SIDE) },
    },
    vertexShader: simVert,
    fragmentShader: imageSimFrag,
  });

  simScene = new THREE.Scene();
  simCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1);
  simScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), simMaterial));

  targetA = createTarget();
  targetB = createTarget();

  // prime both from the seed so the first frame reads real state
  renderer.setRenderTarget(targetA);
  renderer.render(simScene, simCamera);
  renderer.setRenderTarget(targetB);
  renderer.render(simScene, simCamera);
  renderer.setRenderTarget(null);

  pointMaterial = new THREE.ShaderMaterial({
    uniforms: {
      posTex: { value: targetB.texture },
      nextTex: { value: blank },
      prevTex: { value: blank },
      // the blank has no mip chain so it is only read at level zero
      nextLod: { value: 0 },
      prevLod: { value: 0 },
      fade: { value: 1 },
      // device pixels between neighbouring particles
      baseSpacing: { value: 1 },
      gridSize: { value: SIDE },
      gridDims: { value: new THREE.Vector2(SIDE, SIDE) },
      aberration: { value: 0.15 },
    },
    vertexShader: imagePointVert,
    fragmentShader: imagePointFrag,
    transparent: true,
    // points at this density overlap and the image is meant to read flat
    depthWrite: false,
    depthTest: false,
  });

  points = new THREE.Points(gridGeometry(), pointMaterial);
  // particles are drawn wherever the sim puts them, so three cannot cull by the
  // geometry's own bounds
  points.frustumCulled = false;
  imageScene.add(points);
}

// the shape of the grid and how far apart it puts particles on screen. the pitch
// has to come from here because the panel's pixel size is not in the plane space
// the particles live in
function updateGrid() {
  if (!renderer || !pointMaterial || !simMaterial) {
    return;
  }

  renderer.getDrawingBufferSize(bufferSize);

  const total = SIDE * SIDE;
  const columns = Math.max(1, Math.round(Math.sqrt(total * texAspect)));
  // floored so the grid always fits. the point shader discards the remainder
  const rows = Math.max(1, Math.floor(total / columns));

  const fitX = texAspect > planeAspect ? 1 : texAspect / planeAspect;
  const fitY = texAspect > planeAspect ? planeAspect / texAspect : 1;

  simMaterial.uniforms.gridDims.value.set(columns, rows);
  pointMaterial.uniforms.gridDims.value.set(columns, rows);
  pointMaterial.uniforms.baseSpacing.value = Math.max(
    (bufferSize.x * fitX) / columns,
    (bufferSize.y * fitY) / rows,
  );
}

export function setImageParticleAspect(aspect) {
  if (!simMaterial) {
    return;
  }

  planeAspect = aspect;
  simMaterial.uniforms.planeAspect.value = aspect;
  updateGrid();
}

// x and y in the panel's own 0..1 space
export function setImageParticleMouse(x, y, active) {
  if (!simMaterial) {
    return;
  }

  simMaterial.uniforms.mouse.value.set(x * 2 - 1, y * 2 - 1);
  simMaterial.uniforms.mouseActive.value = active ? 1 : 0;
}

// the mip level whose texels are about the size of one particle's cell
function lodFor(texture) {
  const image = texture && texture.image;

  if (!image || !image.width || !texture.generateMipmaps) {
    return 0;
  }

  return Math.max(0, Math.log2(Math.max(image.width, image.height) / SIDE) + LOD_BIAS);
}

export function setImageParticleTexture(texture, aspect) {
  if (!pointMaterial) {
    return;
  }

  // the outgoing image is sampled until the fade finishes
  pointMaterial.uniforms.prevTex.value = pointMaterial.uniforms.nextTex.value;
  pointMaterial.uniforms.prevLod.value = pointMaterial.uniforms.nextLod.value;
  pointMaterial.uniforms.nextTex.value = texture;
  pointMaterial.uniforms.nextLod.value = lodFor(texture);

  texAspect = aspect;
  simMaterial.uniforms.texAspect.value = aspect;
  updateGrid();

  // killed first. pressing faster than a switch takes leaves two tweens on the
  // same numbers
  gsap.killTweensOf(transition);
  transition.fade = 0;
  transition.burst = 1;
  gsap.to(transition, { fade: 1, duration: FADE_DURATION, ease: 'power2.inOut' });
  gsap.to(transition, { burst: 0, duration: BURST_DURATION, ease: 'power2.out' });
}

// steps the sim and binds the result as the position texture the points read.
// call before rendering the image scene
export function stepImageParticles(dtScale) {
  if (!simMaterial) {
    return;
  }

  simMaterial.uniforms.dtScale.value = dtScale;
  simMaterial.uniforms.burst.value = transition.burst;
  pointMaterial.uniforms.fade.value = transition.fade;

  const previous = targetA;
  targetA = targetB;
  targetB = previous;

  simMaterial.uniforms.posTex.value = targetA.texture;
  renderer.setRenderTarget(targetB);
  renderer.render(simScene, simCamera);
  renderer.setRenderTarget(null);

  pointMaterial.uniforms.posTex.value = targetB.texture;
}
