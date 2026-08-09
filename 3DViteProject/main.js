import * as THREE from 'three';
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';
import { vertexShader } from './glsl/main.vertFBO.js';
import { fragmentShader } from './glsl/main.fragFBO.js';
import { simvertFBO } from './glsl/simvertFBO.js';
import { simfragFBO } from './glsl/simfragFBO.js';
import {
  initImageParticles,
  setImageParticleAspect,
  setImageParticleMouse,
  setImageParticleTexture,
  stepImageParticles,
} from './imageParticles.js';
import { GLTFLoader } from 'three/examples/jsm/Addons.js';
import gsap from 'gsap';
import { initAnim } from './animation.js';
import { getGPUTier } from 'detect-gpu';
import { rig, initRig, setRigTarget, updateCameraFraming } from './cameraRig.js';
import { PROJECTS } from './content/projects.js';
import { initRouter } from './router.js';
import { renderNav } from './nav.js';
import { renderWork } from './work.js';
import { initMarkTargets } from './markTargets.js';
import { initTheme, applyCloudPalette } from './theme.js';
import './menu.js';
import './attractors.js';
import './viewerControls.js';

let canvasBoundingRect, projectImageSection, renderMaterial, simMaterial,
 shipMesh, renderTargetA, renderTargetB, fbo, img

// before first paint, so the page is never painted in the wrong palette
initTheme();

export const camera = new THREE.PerspectiveCamera(50, window.innerWidth/window.innerHeight, 0.001, 1000);
export const mobile = detectMob();

// the ship's cloud, drawn to a fixed fullscreen canvas
const renderer = new THREE.WebGLRenderer({alpha: true});
const simScene = new THREE.Scene();


// the project screenshot's cloud, drawn to a canvas that lives inside a panel
const imageRenderer = new THREE.WebGLRenderer({ alpha: true });
const imageScene = new THREE.Scene();
// orthographic over a unit quad. the image is fitted to the box in the shader
// from the two aspects, so the camera needs no aspect of its own
const imagecam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 10);
imagecam.position.z = 1;

const pointer = new THREE.Vector2();
const imagePointer = new THREE.Vector2();
const raycaster = new THREE.Raycaster();

// outside the screenshot panel the image's particles are left alone
let imagePointerInside = false;

// no cursor until the pointer has moved, ndc (0, 0) is the middle of the cloud
let pointerActive = false;

let imageSectionVisible = true;

const textureLoader = new THREE.TextureLoader();
const loadedTextures = [];

// screenshots by project pos-index, null where the model is the image
const textures = PROJECTS.map((project) => project.shot);
const mobileTextures = PROJECTS.map((project) => project.shotMobile);

function main () {
  initScene();
  initRig();
  setRigTarget(document.querySelector('.LandingStage'));
  initImageScene();
  preloadTextures();
  initEvents()
  // after the project panels and the job list exist, the router toggles them
  renderWork();
  renderNav();
  initRouter();
  loadModelGeometries();
}

// a 3x display costs 9x the fragment work for no visible gain on a particle field
const MAX_PIXEL_RATIO = 2;

// the ship's own framing, kept aside since rig.radius and rig.extent get tweened
// away to the attractor's
export const shipFraming = { radius: 1, extent: { x: 1, y: 1, z: 1 } };

// sim rate in 60Hz frames per real frame, 2.4 == 144/60
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

    // the grid reflows for reasons a resize listener never sees, so observe the
    // boxes. all four, menu.js moves the canvas between them
    const boxes = new ResizeObserver(setImageRendererSize);
    document.querySelectorAll(".project-image-section").forEach((box) => boxes.observe(box));

    // the canvas, not a panel: it gets reparented and the observer follows it
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
          // load bearing, the point shader reads at an explicit mip level
          texture.generateMipmaps = true;
          texture.minFilter = THREE.LinearMipmapLinearFilter;
          texture.magFilter = THREE.LinearFilter;
          texture.needsUpdate = true;
          loadedTextures[index] = texture;
          // the first project's screenshot is the one on screen, hand it over
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

  // size against whichever panel currently holds the canvas
  var box = imageRenderer.domElement.parentElement || projectImageSection;

  // https://stackoverflow.com/questions/25197184/get-the-height-of-an-element-minus-padding-margin-border-widths
  var cs = getComputedStyle(box);
  var paddingX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
  var paddingY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);

  var borderX = parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth);
  var borderY = parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);

  // the content box, which is what the canvas has to fill
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

// onWindowResize reads layout, so coalesce bursts into one handler per frame
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

// the rect of whichever panel holds the canvas
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

  // devicePixelRatio changes with the display and the zoom level. the camera's
  // aspect belongs to the rig, which rebuilds it every frame
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

          // the sphere sets the scale the animations tween, the box gives the
          // silhouette the rig frames against
          shipMesh.geometry.computeBoundingSphere();
          shipMesh.geometry.computeBoundingBox();
          const { radius } = shipMesh.geometry.boundingSphere;
          const halfExtent = shipMesh.geometry.boundingBox.getSize(new THREE.Vector3()).multiplyScalar(0.5);
          rig.radius = radius;
          // mutated, not replaced, there are tweens writing to this object
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
  
// side of the sim texture, so the ceiling on particle count. every texel is
// stepped every frame whether or not it is drawn
const DESKTOP_TEXTURE_SIDE = 1024;
const MOBILE_TEXTURE_SIDE = 256;

// the counts the slider stops on, no need to be square numbers
const PARTICLE_STEPS = [25000, 50000, 100000, 250000, 500000, 750000, 1000000];

// where the slider starts, by gpu tier. every step stays reachable
function defaultCountForTier(tier) {
  if (tier >= 3) return 1000000;
  if (tier === 2) return 500000;
  if (tier === 1) return 250000;
  return 100000;
}

// module scope so the count control can reach them after initFBO
let particleGeometry = null;
let particleTotal = 0;
let defaultParticleCount = 250000;

// the ship's own target, kept so a mark can be swapped back off
let shipTargetTexture = null;
// which of the two target slots the cloud is reading. the other is free to write
let activeTargetSlot = 0;
let activeTargetTexture = null;
let targetTween = null;

// the crossfade of where the particles are heading, not how fast they get there
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

// one point per particle, spread over the model's surface by area. the colour is
// packed into w so one RGBA texture carries both
function samplePositions(numSamples, Mesh) {
  let positions = [];
  const sampler = new MeshSurfaceSampler(Mesh).build();

  for (let i = 0; i < numSamples; i++) {
    let position = new THREE.Vector4();
    let normals = new THREE.Vector3();
    let colour = new THREE.Vector3();

    sampler.sample(position, normals, colour);

    // three 8 bit channels packed into one float, unpacked again in main.fragFBO
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
  // verify browser can support float textures
  if (!renderer.capabilities.floatVertexTextures) {
    console.warn('Browser does not support float vertex textures, particles will not render properly');
  }

  let gputier = await getGPUTier();
  // one texel per particle, so the side is the hard ceiling on count
  let w = mobile ? MOBILE_TEXTURE_SIDE : DESKTOP_TEXTURE_SIDE;
  let h = w;
  defaultParticleCount = defaultCountForTier(gputier.tier);

  // scattered, so the ship assembles itself out of nothing on load
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

  // one sample per texel of the sim texture
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
  
  // state 0 pulls every particle to its own point on the hull, state 1 runs an
  // attractor. see glsl/simfragFBO.js
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
      // both slots start on the ship, before any mark has been built
      targetTexA: { value: initialShipDataTex },
      targetTexB: { value: initialShipDataTex },
      targetMix: { value: 0 },
      // the cursor as the camera ray through the pointer, not a point on z = 0
      mouseOrigin: { value: new THREE.Vector3() },
      mouseDir: { value: new THREE.Vector3(0, 0, -1) },
      // distance from the camera to the centre of the cloud
      mouseDepth: { value: 1.0 },
      mouseActive: { value: 0.0 },
    },
    vertexShader: simvertFBO,
    fragmentShader: simfragFBO,
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
  
  // a single quad covering the sim texture, so one fragment runs per particle
  fbo = new FBO(w, simMaterial);

  // marks are sampled into targets of the same side, one texel per particle
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
  
  // a target can't be read and written in the same pass, so state alternates
  // between this pair every frame
  renderTargetB = renderTargetA.clone();

  // prime both, so the first frame reads real state rather than an empty target
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
    // the same two slots the sim marches towards, read here for their colours
    targetTexA: { value: initialShipDataTex },
    targetTexB: { value: initialShipDataTex },
    targetMix: { value: 0 },
    pointSize: { value: 2.0 },
    colourMix: { value: 0.0 },
    // filled in by applyCloudPalette, these only have to be the right type
    rampLow: { value: new THREE.Vector3() },
    rampMid: { value: new THREE.Vector3() },
    rampHigh: { value: new THREE.Vector3() },
    baseGain: { value: new THREE.Vector3(1, 1, 1) },
    baseDesaturate: { value: 0 },
    baseTint: { value: new THREE.Vector3(1, 1, 1) },
    // both slots start on the ship, whose colours are the model's own
    gradeA: { value: 1 },
    gradeB: { value: 1 }},
    vertexShader: vertexShader,
    fragmentShader: fragmentShader,
  });

  applyCloudPalette();
  
  particleGeometry = new THREE.BufferGeometry();
  let positions = new Float32Array((w * w) * 3);
  let uvs = new Float32Array((w * w) * 2);
  // position holds the sim texel this particle reads. texel centres, so
  // NearestFilter can't land on a boundary
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

    // on gsap's ticker so scroll, tweens and render share one clock
    gsap.ticker.add(render);
    initAnim();
  }
  
  const clock = new THREE.Clock();

  function render() {
    // a backgrounded tab still gets throttled frames on some browsers
    if (document.hidden) {
      return;
    }

    // how many 60Hz frames this frame was worth, capped so a dropped frame can't
    // blow up the attractor
    const frameScale = Math.min(clock.getDelta() * 60, 2);
    simMaterial.uniforms.dtScale.value = frameScale * SIM_SPEED;
    // follows the framing tween so the cursor keeps its size against the cloud
    simMaterial.uniforms.cloudRadius.value = rig.radius;

    updateCameraFraming(camera);

    // the screenshot is a million particles of its own on top of the ship's
    if (imageSectionVisible && !mobile) {
      setImageParticleMouse(imagePointer.x, imagePointer.y, imagePointerInside);
      stepImageParticles(frameScale);
      imageRenderer.render(imageScene, imagecam);
    }

    // ping-pong: read from A, write to B, then B is what the points draw from
    var temp = renderTargetA;
    renderTargetA = renderTargetB;
    renderTargetB = temp;
    simMaterial.uniforms.posTex.value = renderTargetA.texture;
    renderer.setRenderTarget(renderTargetB);
    renderer.render(fbo.scene, fbo.camera);
    renderer.setRenderTarget(null);
    renderMaterial.uniforms.posTex.value = renderTargetB.texture;
    
    renderer.render(simScene, camera);
    
    // after the render, so the rig's view offset is already in the projection
    raycaster.setFromCamera(pointer, camera);
    simMaterial.uniforms.mouseOrigin.value.copy(raycaster.ray.origin);
    simMaterial.uniforms.mouseDir.value.copy(raycaster.ray.direction);
    // the cloud is centred on the origin
    simMaterial.uniforms.mouseDepth.value = Math.max(camera.position.length(), 0.001);
    simMaterial.uniforms.mouseActive.value = pointerActive ? 1.0 : 0.0;
  }

  main()
// the sim material only exists after the GLB has loaded
export function getSimMaterial() {
  return simMaterial;
}

// how many particles the sim texture holds, 1,048,576 on desktop
export function getParticleTotal() {
  return particleTotal;
}

// the slider's stops, clamped to what this device's texture can supply
export function getParticleSteps() {
  const steps = PARTICLE_STEPS.filter((count) => count <= particleTotal);
  // if the round steps stop short of the texture, add the real total
  if (!steps.length || steps[steps.length - 1] < particleTotal * 0.9) {
    steps.push(particleTotal);
  }
  return steps;
}

export function getDefaultParticleCount() {
  return defaultParticleCount;
}

// draws a prefix of the particle buffer, a fair sample since samplePositions
// walks the mesh in random order. the sim still steps every particle
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

// writes a target into whichever slot the cloud is not reading, then crossfades
// onto it. graded is 1 where the colours are the model's own and want taking to
// the page's palette
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
  // the screenshots aren't all the same shape
  setImageParticleTexture(texture, texture.image.width / texture.image.height);
}
    
  