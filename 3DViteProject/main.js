import * as THREE from 'three';
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';
import { GLTFLoader } from 'three/examples/jsm/Addons.js';
import gsap from 'gsap';
import { getGPUTier } from 'detect-gpu';
import { cloudPointVert, cloudPointFrag } from './glsl/cloudPoint.js';
import { simVert } from './glsl/common.js';
import { cloudSimFrag } from './glsl/cloudSim.js';
import {
  initImageParticles,
  setImageParticleAspect,
  setImageParticleMouse,
  setImageParticleTexture,
  stepImageParticles,
} from './imageParticles.js';
import { initAnim } from './animation.js';
import { rig, initRig, setRigTarget, updateCameraFraming } from './cameraRig.js';
import { PROJECTS } from './content.js';
import { initRouter, renderNav } from './router.js';
import { renderWork } from './work.js';
import { initMarkTargets } from './markTargets.js';
import { initTheme, applyCloudPalette } from './theme.js';
import { initProjects } from './projects.js';
import { initShapeSwitch } from './attractors.js';
import { initViewerControls } from './viewerControls.js';

let canvasBoundingRect, projectImageSection, renderMaterial, simMaterial,
 shipMesh, renderTargetA, renderTargetB, fbo, img

initTheme();

export const camera = new THREE.PerspectiveCamera(50, window.innerWidth/window.innerHeight, 0.001, 1000);
export const mobile = detectMob();

// the ship's cloud, drawn to a fixed fullscreen canvas
const renderer = new THREE.WebGLRenderer({alpha: true});
const simScene = new THREE.Scene();


// the project screenshot's cloud, drawn to a canvas inside a panel
const imageRenderer = new THREE.WebGLRenderer({ alpha: true });
const imageScene = new THREE.Scene();
const imagecam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 10);
imagecam.position.z = 1;

const pointer = new THREE.Vector2();
const imagePointer = new THREE.Vector2();
const raycaster = new THREE.Raycaster();

let imagePointerInside = false;
let pointerActive = false;
let imageSectionVisible = true;

const textureLoader = new THREE.TextureLoader();
const loadedTextures = [];

const textures = PROJECTS.map((project) => project.shot);
const mobileTextures = PROJECTS.map((project) => project.shotMobile);

// the panels and the work list have to exist before anything measures or routes
// to them
function main () {
  initScene();
  initRig();
  initProjects();
  renderWork();
  renderNav();
  initShapeSwitch();
  initViewerControls();
  setRigTarget(document.querySelector('.LandingStage'));
  initImageScene();
  preloadTextures();
  initEvents()
  initRouter();
  loadModelGeometries();
}

// a 3x display costs 9x the fragment work for no visible gain
const MAX_PIXEL_RATIO = 2;

// kept aside because rig.radius and rig.extent tween away to the attractor's
export const shipFraming = { radius: 1, extent: { x: 1, y: 1, z: 1 } };

// 60Hz frames of sim per real frame
const SIM_SPEED = 2.4;

function currentPixelRatio() {
  return Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO);
}

function initScene() {
  renderer.setPixelRatio(currentPixelRatio());
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.domElement.id = 'threeJSCanvas';
  document.body.appendChild( renderer.domElement );

  renderer.setClearColor(0x000000, 0);
}

function initImageScene() {

  projectImageSection = document.querySelector(".project-image-section.project-section");

  if (mobile) {
    img = document.createElement("img");
    img.src = mobileTextures[0];
    projectImageSection.appendChild(img);
  }
  else {
    imageRenderer.setPixelRatio(currentPixelRatio());
    projectImageSection.appendChild(imageRenderer.domElement);
    initImageParticles(imageRenderer, imageScene);
    setImageRendererSize();

    // all four boxes because projects.js moves the canvas between them
    const boxes = new ResizeObserver(setImageRendererSize);
    document.querySelectorAll(".project-image-section").forEach((box) => boxes.observe(box));

    // the canvas, not a panel, so the observer follows the reparenting
    new IntersectionObserver((entries) => {
      imageSectionVisible = entries[entries.length - 1].isIntersecting;
    }).observe(imageRenderer.domElement);
  }
}

function preloadTextures() {
  textures.forEach((textureUrl, index) => {
    if (textureUrl) {
      textureLoader.load(
        textureUrl,
        (texture) => {
          // load bearing. the point shader reads an explicit mip level
          texture.generateMipmaps = true;
          texture.minFilter = THREE.LinearMipmapLinearFilter;
          texture.magFilter = THREE.LinearFilter;
          texture.needsUpdate = true;
          loadedTextures[index] = texture;
          if (index === 0) {
            updateImageTexture(0);
          }
        },
        undefined,
        (error) => {
          console.error('Error loading texture:', error);
        }
      );
    } else {
      loadedTextures[index] = null;
    }
  });
}

function setImageRendererSize() {
  if (mobile) {
    return;
  }

  var box = imageRenderer.domElement.parentElement || projectImageSection;

  var cs = getComputedStyle(box);
  var paddingX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
  var paddingY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);

  var borderX = parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth);
  var borderY = parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);

  var elementWidth = box.offsetWidth - paddingX - borderX;
  var elementHeight = box.offsetHeight - paddingY - borderY;

  if (elementWidth < 1 || elementHeight < 1) {
    return;
  }

  imageRenderer.setPixelRatio(currentPixelRatio());
  imageRenderer.setSize(elementWidth, elementHeight);
  setImageParticleAspect(elementWidth / elementHeight);

  refreshCanvasBoundingRect();
}

function onPointerMove( event ) {

  pointerActive = true;

  pointer.x = ( event.clientX / window.innerWidth ) * 2 - 1;
  pointer.y = - ( event.clientY / window.innerHeight ) * 2 + 1;

  // the image shader wants the pointer in the canvas's own 0..1 space
  if (canvasBoundingRect) {
    imagePointer.x = (((event.clientX - canvasBoundingRect.left) / (canvasBoundingRect.width)));
    imagePointer.y = (1 - ((event.clientY - canvasBoundingRect.top) / (canvasBoundingRect.height)));
    imagePointerInside = imagePointer.x >= 0 && imagePointer.x <= 1
      && imagePointer.y >= 0 && imagePointer.y <= 1;
  }

  moveBackgroundAnim(event.clientX, event.clientY, false);
}

function initEvents() {

  document.addEventListener( 'pointermove', onPointerMove );

  refreshCanvasBoundingRect();

  window.addEventListener( 'resize', requestResize, false );
  window.addEventListener('scroll', handleScroll);
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
    onWindowResize();
  });
}

function handleScroll() {
  moveBackgroundAnim((pointer.x + 1) / 2 * window.innerWidth, -(pointer.y - 1) / 2 * window.innerHeight, true);

  refreshCanvasBoundingRect();
}

function refreshCanvasBoundingRect() {
  if (mobile) {
    return;
  }

  var canvas = document.querySelector('[status="active"] .project-image-section canvas');
  if (canvas) {
    canvasBoundingRect = canvas.getBoundingClientRect();
  }
}

function onWindowResize(){

  renderer.setPixelRatio(currentPixelRatio());
  renderer.setSize( window.innerWidth, window.innerHeight );
  setImageRendererSize();

}

function loadModelGeometries() {
    const modelLoader = new GLTFLoader();
    modelLoader.load( 'models/radiant_pillar_baked.glb', function ( gltf ) {
      gltf.scene.traverse((child) => {
        if (child.isMesh) {
          shipMesh = child.clone();
          shipMesh.geometry = child.geometry.clone();
          shipMesh.geometry.center()
          shipMesh.geometry.scale(0.085, 0.085, 0.085);

          // the sphere sets the scale the animations tween. the box gives the
          // silhouette the rig frames against
          shipMesh.geometry.computeBoundingSphere();
          shipMesh.geometry.computeBoundingBox();
          const { radius } = shipMesh.geometry.boundingSphere;
          const halfExtent = shipMesh.geometry.boundingBox.getSize(new THREE.Vector3()).multiplyScalar(0.5);
          rig.radius = radius;
          // mutated not replaced. tweens write to this object
          rig.extent.x = halfExtent.x / radius;
          rig.extent.y = halfExtent.y / radius;
          rig.extent.z = halfExtent.z / radius;

          shipFraming.radius = rig.radius;
          shipFraming.extent = { x: rig.extent.x, y: rig.extent.y, z: rig.extent.z };
        }
      });

      initFBO();
    }, undefined, function ( error ) {

    console.error( error );
    });
}

// side of the sim texture, so the ceiling on particle count. every texel steps
// every frame whether or not it is drawn
const DESKTOP_TEXTURE_SIDE = 1024;
const MOBILE_TEXTURE_SIDE = 256;

const PARTICLE_STEPS = [25000, 50000, 100000, 250000, 500000, 750000, 1000000];

function defaultCountForTier(tier) {
  if (tier >= 3) return 1000000;
  if (tier === 2) return 500000;
  if (tier === 1) return 250000;
  return 100000;
}

let particleGeometry = null;
let particleTotal = 0;
let defaultParticleCount = 250000;

let shipTargetTexture = null;
// which slot the cloud reads. the other is free to write
let activeTargetSlot = 0;
let activeTargetTexture = null;
let targetTween = null;

const TARGET_CROSSFADE = 1.2;

let scrollLeft = 0, scrollTop = 0;


var backgroundAnim = document.querySelector(".BackgroundAnimation");
let tweenX = gsap.quickTo(backgroundAnim, "left", { duration: 0.4, ease: "power3" }),
tweenY = gsap.quickTo(backgroundAnim, "top", { duration: 0.4, ease: "power3" });

function moveBackgroundAnim(x, y, scrolling) {
  if (scrolling) {
    scrollLeft = (window.scrollX !== undefined) ? window.scrollX : (document.documentElement || document.body.parentNode || document.body).scrollLeft;
    scrollTop = (window.scrollY !== undefined) ? window.scrollY : (document.documentElement || document.body.parentNode || document.body).scrollTop;
  }
  tweenX(x + scrollLeft);
  tweenY(y + scrollTop);

}

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

// one point per particle spread over the model's surface by area
function samplePositions(numSamples, Mesh) {
  let positions = [];
  const sampler = new MeshSurfaceSampler(Mesh).build();

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
  if (!renderer.capabilities.floatVertexTextures) {
    console.warn('Browser does not support float vertex textures, particles will not render properly');
  }

  let gputier = await getGPUTier();
  let w = mobile ? MOBILE_TEXTURE_SIDE : DESKTOP_TEXTURE_SIDE;
  let h = w;
  defaultParticleCount = defaultCountForTier(gputier.tier);

  // scattered so the ship assembles itself on load
  let initPos = new Float32Array(w * h * 4);
  for (let i = 0; i < w; i++) {
    for (let j = 0; j < w; j++) {
      let index = (i + j * w) * 4;

      const distance = Math.sqrt((Math.random())) * 20.0;
      const theta = THREE.MathUtils.randFloatSpread(360);
      const phi = THREE.MathUtils.randFloatSpread(360);
      initPos[index] =  distance * Math.sin(theta) * Math.cos(phi)
      initPos[index + 1] =  distance * Math.sin(theta) * Math.sin(phi);
      initPos[index + 2] =  1.0 * Math.cos(theta);
      initPos[index + 3] =  1.0;
    }
  }

  const numInitialPositions = w * h;

  let initialShipPositions = samplePositions(numInitialPositions, shipMesh);
  let initialPositionsArray = new Float32Array(numInitialPositions * 4);
  initialShipPositions.forEach((position, index) => {
    initialPositionsArray[index * 4] = position.x;
    initialPositionsArray[index * 4 + 1] = position.y;
    initialPositionsArray[index * 4 + 2] = position.z;
    initialPositionsArray[index * 4 + 3] = position.w;
  });

  let initialCircleDataTex = new THREE.DataTexture(initPos, w, h, THREE.RGBAFormat, THREE.FloatType);
  let initialShipDataTex = new THREE.DataTexture(initialPositionsArray, w, h, THREE.RGBAFormat, THREE.FloatType);

  initialShipDataTex.minFilter = THREE.NearestFilter;
  initialShipDataTex.magFilter = THREE.NearestFilter;
  initialShipDataTex.needsUpdate = true;

  // state 0 pulls every particle to its point on the target. state 1 runs an
  // attractor. see glsl/cloudSim.js
  simMaterial = new THREE.ShaderMaterial({
    uniforms: {
      state: { value: 0 },
      dtScale: {value: 1.0},
      // idle sits at morph 1, fully arrived at attractorTo
      attractorFrom: {value: 0},
      attractorTo: {value: 0},
      morph: {value: 1.0},
      cloudRadius: {value: 1.0},
      posTex: { value: initialCircleDataTex },
      targetTexA: { value: initialShipDataTex },
      targetTexB: { value: initialShipDataTex },
      targetMix: { value: 0 },
      mouseOrigin: { value: new THREE.Vector3() },
      mouseDir: { value: new THREE.Vector3(0, 0, -1) },
      mouseDepth: { value: 1.0 },
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

  initMarkTargets(renderer, w);

  renderTargetA = new THREE.WebGLRenderTarget(w, h, {
    wrapS: THREE.RepeatWrapping,
    wrapT: THREE.RepeatWrapping,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    format: THREE.RGBAFormat,
    type: THREE.FloatType,
    stencilBuffer: false,
  });

  // a target cannot be read and written in one pass, so state alternates between
  // this pair every frame
  renderTargetB = renderTargetA.clone();

  renderer.setRenderTarget(renderTargetA);
  renderer.clear();
  renderer.render(fbo.scene, fbo.camera);
  renderer.setRenderTarget(renderTargetB);
  renderer.clear();
  renderer.render(fbo.scene, fbo.camera);
  renderer.setRenderTarget(null);


  shipTargetTexture = initialShipDataTex;
  activeTargetTexture = initialShipDataTex;

  renderMaterial = new THREE.ShaderMaterial({
    uniforms: { posTex: { value: null },
    targetTexA: { value: initialShipDataTex },
    targetTexB: { value: initialShipDataTex },
    targetMix: { value: 0 },
    pointSize: { value: 2.0 },
    colourMix: { value: 0.0 },
    // filled in by applyCloudPalette. only the type matters here
    rampLow: { value: new THREE.Vector3() },
    rampMid: { value: new THREE.Vector3() },
    rampHigh: { value: new THREE.Vector3() },
    baseGain: { value: new THREE.Vector3(1, 1, 1) },
    baseDesaturate: { value: 0 },
    baseTint: { value: new THREE.Vector3(1, 1, 1) },
    gradeA: { value: 1 },
    gradeB: { value: 1 }},
    vertexShader: cloudPointVert,
    fragmentShader: cloudPointFrag,
  });

  applyCloudPalette();

  particleGeometry = new THREE.BufferGeometry();
  let positions = new Float32Array((w * w) * 3);
  let uvs = new Float32Array((w * w) * 2);
  // a particle's "position" is the sim texel it reads. texel centres so
  // NearestFilter cannot land on a boundary
  for (let j = 0; j < w; j++) {
    for (let i = 0; i < w; i++) {

      let index = (i + j * w);
      positions[index * 3] = (i + 0.5) / w;
      positions[index * 3 + 1] = (j + 0.5) / w;
      positions[index * 3 + 2] = 0.0;
      uvs[index * 2] = (i + 0.5) / w;
      uvs[index * 2 + 1] = (j + 0.5) / w;
    }
  }
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    particleTotal = w * w;

    var points = new THREE.Points(particleGeometry, renderMaterial);
    simScene.add(points);
    renderMaterial.uniforms.posTex.value = initialShipDataTex;

    // on gsap's ticker so everything shares one clock
    gsap.ticker.add(render);
    initAnim();
  }

  const clock = new THREE.Clock();

  function render() {
    // a backgrounded tab still gets throttled frames on some browsers
    if (document.hidden) {
      return;
    }

    // capped so a dropped frame cannot blow up the attractor
    const frameScale = Math.min(clock.getDelta() * 60, 2);
    simMaterial.uniforms.dtScale.value = frameScale * SIM_SPEED;
    simMaterial.uniforms.cloudRadius.value = rig.radius;

    updateCameraFraming(camera);

    if (imageSectionVisible && !mobile) {
      setImageParticleMouse(imagePointer.x, imagePointer.y, imagePointerInside);
      stepImageParticles(frameScale);
      imageRenderer.render(imageScene, imagecam);
    }

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
    simMaterial.uniforms.mouseDepth.value = Math.max(camera.position.length(), 0.001);
    simMaterial.uniforms.mouseActive.value = pointerActive ? 1.0 : 0.0;
  }

  main()
// the sim material only exists after the GLB has loaded
export function getSimMaterial() {
  return simMaterial;
}

export function getParticleTotal() {
  return particleTotal;
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

// draws a prefix of the particle buffer. samplePositions walks the mesh in
// random order so a prefix is a fair sample
export function setParticleCount(count) {
  if (!particleGeometry) {
    return 0;
  }
  const drawn = Math.max(1, Math.min(Math.round(count), particleTotal));
  particleGeometry.setDrawRange(0, drawn);
  return drawn;
}

export function getRenderMaterial() {
  return renderMaterial;
}

export function getShipTarget() {
  return shipTargetTexture;
}

// writes a target into the slot the cloud is not reading, then crossfades onto
// it. graded 1 where the colours are the model's own and want the page palette
export function setCloudTarget(texture, { duration = TARGET_CROSSFADE, graded = 1 } = {}) {
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

export function updateImageTexture(index) {
  if (loadedTextures[index] == null || textures[index] == null) {
    return;
  }

  if (mobile) {
    img.src = mobileTextures[index];
    return;
  }

  const texture = loadedTextures[index];
  setImageParticleTexture(texture, texture.image.width / texture.image.height);
}
