import * as THREE from 'three';
import { simVert } from './glsl/common.js';
import { markSampleFrag } from './glsl/markSample.js';

// turns a picture into a particle target. it rasterises to an alpha mask, then
// one gpu pass samples that mask into a position texture the sim can march
// towards, carrying the picture's own colours with it

// about a texel per device pixel at the size the stage draws, so the detail
// ceiling. measure walks it once per url and caches
const MASK_SIDE = 1024;

// the framing radius a mark is fitted to. same as the attractors
const MARK_RADIUS = 4;
const MARK_DEPTH = 0.04;

let renderer = null;
let material = null;
let scene = null;
let camera = null;
let side = 0;
let targets = [];
let next = 0;

const masks = new Map();

export function initMarkTargets(sharedRenderer, textureSide) {
  renderer = sharedRenderer;
  side = textureSide;

  material = new THREE.ShaderMaterial({
    uniforms: {
      mask: { value: null },
      maskMin: { value: new THREE.Vector2(0, 0) },
      maskMax: { value: new THREE.Vector2(1, 1) },
      fallback: { value: new THREE.Vector2(0.5, 0.5) },
      extent: { value: new THREE.Vector2(MARK_RADIUS, MARK_RADIUS) },
      lattice: { value: new THREE.Vector2(1, 1) },
      simSide: { value: side },
      depth: { value: MARK_RADIUS * MARK_DEPTH },
      tint: { value: new THREE.Color(1, 1, 1) },
    },
    vertexShader: simVert,
    fragmentShader: markSampleFrag,
  });

  scene = new THREE.Scene();
  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1);
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));

  // one per slot in the sim's pair, so writing the next mark never touches the
  // one being crossfaded out of
  targets = [createTarget(side), createTarget(side)];
}

function createTarget(textureSide) {
  return new THREE.WebGLRenderTarget(textureSide, textureSide, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    format: THREE.RGBAFormat,
    type: THREE.FloatType,
    depthBuffer: false,
    stencilBuffer: false,
  });
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`could not load mark ${url}`));
    image.src = url;
  });
}

function measure(pixels, maskSide) {
  let minX = maskSide;
  let minY = maskSide;
  let maxX = -1;
  let maxY = -1;
  let fallbackX = maskSide * 0.5;
  let fallbackY = maskSide * 0.5;
  let opaque = 0;

  for (let y = 0; y < maskSide; y++) {
    for (let x = 0; x < maskSide; x++) {
      if (pixels[(y * maskSide + x) * 4 + 3] <= 127) {
        continue;
      }

      opaque++;
      if (opaque === 1) {
        fallbackX = x;
        fallbackY = y;
      }
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  if (opaque === 0) {
    return null;
  }

  return {
    // half a texel in so a nearest sample cannot fall outside
    min: new THREE.Vector2((minX + 0.5) / maskSide, (minY + 0.5) / maskSide),
    max: new THREE.Vector2((maxX + 0.5) / maskSide, (maxY + 0.5) / maskSide),
    fallback: new THREE.Vector2((fallbackX + 0.5) / maskSide, (fallbackY + 0.5) / maskSide),
    width: maxX - minX + 1,
    height: maxY - minY + 1,
    coverage: opaque / ((maxX - minX + 1) * (maxY - minY + 1)),
  };
}

async function rasterise(url) {
  const cached = masks.get(url);

  if (cached) {
    return cached;
  }

  const image = await loadImage(url);
  const canvas = document.createElement('canvas');
  canvas.width = MASK_SIDE;
  canvas.height = MASK_SIDE;

  const context = canvas.getContext('2d', { willReadFrequently: true });

  // contained so a source that is not square keeps its shape
  const scale = Math.min(MASK_SIDE / image.width, MASK_SIDE / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  context.drawImage(
    image,
    (MASK_SIDE - drawWidth) / 2,
    (MASK_SIDE - drawHeight) / 2,
    drawWidth,
    drawHeight,
  );

  const measured = measure(
    context.getImageData(0, 0, MASK_SIDE, MASK_SIDE).data,
    MASK_SIDE,
  );

  if (!measured) {
    throw new Error(`mark ${url} rasterised to nothing`);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  // measure works in the canvas's own coordinates, top row first, and the
  // sampler flips to the world's y itself
  texture.flipY = false;
  texture.needsUpdate = true;

  const mask = { texture, ...measured };
  masks.set(url, mask);
  return mask;
}

// as many cells as there are particles, in the shape of the picture, so the
// cells come out square
function lattice(aspect) {
  const total = side * side;
  const columns = Math.max(1, Math.floor(Math.sqrt(total * aspect)));
  const rows = Math.max(1, Math.floor(columns / aspect));

  return new THREE.Vector2(columns, rows);
}

// resolves to the position texture and the framing the rig needs to fit it
export async function buildMark(url, accent = '#ffffff') {
  if (!renderer || !material) {
    return null;
  }

  const mask = await rasterise(url);

  // the longer side fills the framing radius and the shorter scales off it
  const longest = Math.max(mask.width, mask.height);
  const halfWidth = MARK_RADIUS * (mask.width / longest);
  const halfHeight = MARK_RADIUS * (mask.height / longest);

  material.uniforms.mask.value = mask.texture;
  material.uniforms.maskMin.value.copy(mask.min);
  material.uniforms.maskMax.value.copy(mask.max);
  material.uniforms.fallback.value.copy(mask.fallback);
  material.uniforms.extent.value.set(halfWidth, halfHeight);
  material.uniforms.lattice.value.copy(lattice(mask.width / mask.height));
  material.uniforms.depth.value = MARK_RADIUS * MARK_DEPTH;
  material.uniforms.tint.value.setStyle(accent, THREE.NoColorSpace);

  const target = targets[next];
  next = (next + 1) % targets.length;

  const previousTarget = renderer.getRenderTarget();
  renderer.setRenderTarget(target);
  renderer.render(scene, camera);
  renderer.setRenderTarget(previousTarget);

  return {
    texture: target.texture,
    framing: {
      radius: MARK_RADIUS,
      extent: {
        x: halfWidth / MARK_RADIUS,
        y: halfHeight / MARK_RADIUS,
        z: MARK_DEPTH,
      },
    },
  };
}
