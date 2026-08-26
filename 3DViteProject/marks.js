import * as THREE from 'three';
import { simVert, markSampleFrag } from './shaders.js';

// turns a picture into a particle target: rasterise to an alpha mask, then one
// gpu pass samples the mask into a position texture the sim can march towards

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

// each mask holds a 1024 square canvas alive
const MAX_MASKS = 4;
const masks = new Map();

export function initMarks(sharedRenderer, textureSide) {
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

  // a crossfade reads two targets for its full 1.2s, so the next mark written
  // needs a third
  targets = [createTarget(side), createTarget(side), createTarget(side)];
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

// only the opaque bounding box and one point inside it are wanted, so each row
// is walked in from both ends
function measure(pixels, maskSide) {
  let minX = maskSide;
  let minY = maskSide;
  let maxX = -1;
  let maxY = -1;
  let fallbackX = maskSide * 0.5;
  let fallbackY = maskSide * 0.5;
  let found = false;

  for (let y = 0; y < maskSide; y++) {
    const row = y * maskSide * 4;

    let left = 0;
    while (left < maskSide && pixels[row + left * 4 + 3] <= 127) {
      left++;
    }

    // nothing opaque in this row
    if (left === maskSide) {
      continue;
    }

    let right = maskSide - 1;
    while (pixels[row + right * 4 + 3] <= 127) {
      right--;
    }

    if (!found) {
      fallbackX = left;
      fallbackY = y;
      minY = y;
      found = true;
    }

    if (left < minX) minX = left;
    if (right > maxX) maxX = right;
    maxY = y;
  }

  if (!found) {
    return null;
  }

  return {
    // half a texel in so a nearest sample cannot fall outside
    min: new THREE.Vector2((minX + 0.5) / maskSide, (minY + 0.5) / maskSide),
    max: new THREE.Vector2((maxX + 0.5) / maskSide, (maxY + 0.5) / maskSide),
    fallback: new THREE.Vector2((fallbackX + 0.5) / maskSide, (fallbackY + 0.5) / maskSide),
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

// least recently used out first
function remember(url, mask) {
  masks.set(url, mask);

  while (masks.size > MAX_MASKS) {
    const [oldestUrl, oldest] = masks.entries().next().value;
    masks.delete(oldestUrl);
    oldest.texture.dispose();
  }

  return mask;
}

async function rasterise(url) {
  const cached = masks.get(url);

  if (cached) {
    // re-inserted as most recent
    masks.delete(url);
    masks.set(url, cached);
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
  // measure works in canvas coordinates, top row first, and the sampler flips
  // to the world's y itself
  texture.flipY = false;
  texture.needsUpdate = true;

  return remember(url, { texture, ...measured });
}

// as many cells as there are particles, in the shape of the picture
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
