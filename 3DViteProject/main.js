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
import './menu.js';
import './attractors.js';
import './viewerControls.js';

const root = document.documentElement;
root.dataset.theme = 'dark';

let canvasBoundingRect, projectImageSection, renderMaterial, simMaterial,
 shipMesh, renderTargetA, renderTargetB, fbo, img

export const camera = new THREE.PerspectiveCamera(50, window.innerWidth/window.innerHeight, 0.001, 1000);
export const mobile = detectMob();

// the ship's cloud, drawn to a fixed fullscreen canvas
const renderer = new THREE.WebGLRenderer({alpha: true});
const simScene = new THREE.Scene();


// the project screenshot's cloud, drawn to a canvas that lives inside a panel
const imageRenderer = new THREE.WebGLRenderer({ alpha: true });
const imageScene = new THREE.Scene();
// orthographic over a unit quad. the image is fitted to the box in the shader
// from the two aspects, so the camera needs no aspect of its own and nothing
// has to be recomputed when the window changes shape
const imagecam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 10);
imagecam.position.z = 1;

const pointer = new THREE.Vector2();
const imagePointer = new THREE.Vector2();
const raycaster = new THREE.Raycaster();

// whether the pointer is actually over the screenshot panel, outside it the
// image's particles are left alone
let imagePointerInside = false;

// no cursor until the pointer has moved, ndc (0, 0) is the middle of the cloud
let pointerActive = false;

let imageSectionVisible = true;

const textureLoader = new THREE.TextureLoader();
const loadedTextures = [];

// screenshots by project pos-index. index 1 is the particle project, whose
// image is the model itself, so it has none
const textures = [
  "/Minecraftle.png",
  "None",
  '/QFIN.png',
  '/Vendetta.png'
]

const mobileTextures = [
  "/MinecraftleMob.png",
  "None",
  '/QFINMob.png',
  '/VendettaMob.png'
]

function main () {
  initScene();
  initRig();
  setRigTarget(document.querySelector('.LandingStage'));
  initImageScene();
  preloadTextures();
  initEvents()
  loadModelGeometries();
}

// uncapped devicePixelRatio costs 9x the fragment work on a 3x display for no
// visible gain on a particle field
const MAX_PIXEL_RATIO = 2;

// the ship's own framing, kept aside because rig.radius and rig.extent get
// tweened away to the attractor's
export const shipFraming = { radius: 1, extent: { x: 1, y: 1, z: 1 } };

// sim rate in 60Hz frames per real frame, asked for explicitly rather than
// inherited from whatever the display does. 2.4 == 144/60
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

    // the box is sized by the grid, which reflows for reasons a window resize
    // listener never sees, so observe the elements. all four, not just the one
    // the canvas starts in, since menu.js moves it between the panels
    const boxes = new ResizeObserver(setImageRendererSize);
    document.querySelectorAll(".project-image-section").forEach((box) => boxes.observe(box));

    // observe the canvas, not a panel: menu.js reparents it, and
    // IntersectionObserver tracks the element through that
    new IntersectionObserver((entries) => {
      imageSectionVisible = entries[entries.length - 1].isIntersecting;
    }).observe(imageRenderer.domElement);
  }
}

function preloadTextures() {
  textures.forEach((textureUrl, index) => {
    if (textureUrl !== "None") {
      textureLoader.load(
        textureUrl,
        (texture) => {
          // load bearing. the point shader reads these at an explicit mip
          // level, and without a mip chain that read returns nothing
          texture.generateMipmaps = true;
          texture.minFilter = THREE.LinearMipmapLinearFilter;
          texture.magFilter = THREE.LinearFilter;
          texture.needsUpdate = true;
          loadedTextures[index] = texture;
          // the first project's screenshot is the one on screen when the
          // section is reached, so hand it over as soon as it lands
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

  // size against whichever panel currently holds the canvas, menu.js moves it
  // between projects as they slide past
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

// resize fires far faster than we can usefully respond to and onWindowResize
// reads layout, so coalesce bursts into one handler per frame
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

// the image shader takes the pointer in the image's own 0..1 space, so it needs
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

  // devicePixelRatio changes when the window moves between displays or the zoom
  // level changes. the camera's aspect and projection matrix belong to the rig,
  // which rebuilds them from the target box every frame
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

          // the rig frames against the model's actual extent, so it needs
          // both: the sphere sets the overall scale the animations tween, the
          // box gives the silhouette
          shipMesh.geometry.computeBoundingSphere();
          shipMesh.geometry.computeBoundingBox();
          const { radius } = shipMesh.geometry.boundingSphere;
          const halfExtent = shipMesh.geometry.boundingBox.getSize(new THREE.Vector3()).multiplyScalar(0.5);
          rig.radius = radius;
          // mutated, not replaced, the middle page timeline tweens this object
          // and swapping it out leaves the tween writing to a detached one
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
  
// side of the sim texture, so the ceiling on particle count: 1024 * 1024 is
// 1,048,576. every texel is stepped every frame whether or not it gets drawn,
// so raising this costs sim work on every machine
const DESKTOP_TEXTURE_SIDE = 1024;
const MOBILE_TEXTURE_SIDE = 256;

// the counts the slider stops on. they don't have to be square numbers, only
// the texture is square and the control draws a prefix of it
const PARTICLE_STEPS = [25000, 50000, 100000, 250000, 500000, 750000, 1000000];

// where the slider starts, by gpu tier. detect-gpu is conservative so this is a
// starting point rather than a limit, every step stays reachable
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

// one point per particle, spread over the model's surface by area. the colour
// is packed into w so a single RGBA texture carries both, leaving the sim's own
// alpha channel free to carry speed
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
  // the texture is square and every texel is one particle, so its side is the
  // hard ceiling on count
  let w = mobile ? MOBILE_TEXTURE_SIDE : DESKTOP_TEXTURE_SIDE;
  let h = w;
  defaultParticleCount = defaultCountForTier(gputier.tier);

  // where the particles start: scattered, so the ship assembles itself out of
  // nothing on load rather than simply being there
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
      shipPosTex: { value: initialShipDataTex },
      // the cursor as the camera ray through the pointer, not a point on z = 0
      mouseOrigin: { value: new THREE.Vector3() },
      mouseDir: { value: new THREE.Vector3(0, 0, -1) },
      // distance from the camera to the centre of the cloud, which is where the
      // cursor's radius is quoted
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


  renderMaterial = new THREE.ShaderMaterial({
    uniforms: { posTex: { value: null },
    // static, and the only place the ship's sampled colours are read from
    shipPosTex: { value: initialShipDataTex },
    pointSize: { value: 2.0 },
    colourMix: { value: 0.0 }},
    vertexShader: vertexShader,
    fragmentShader: fragmentShader,
  });
  
  particleGeometry = new THREE.BufferGeometry();
  let positions = new Float32Array((w * w) * 3);
  let uvs = new Float32Array((w * w) * 2);
  // each particle stores the coordinate of the sim texel it reads from in its
  // position attribute. texel centres, so NearestFilter can't land on a boundary
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

    // on gsap's ticker rather than its own raf, so scrolling, tweening and
    // rendering advance on one clock in a fixed order instead of racing
    gsap.ticker.add(render);
    initAnim();
  }
  
  const clock = new THREE.Clock();

  function render() {
    // a backgrounded tab still gets throttled frames on some browsers and
    // there's nothing to see, so skip both render passes
    if (document.hidden) {
      return;
    }

    // how many 60Hz frames this frame was worth, capped so a dropped frame
    // can't blow up the attractor. the ship runs at SIM_SPEED times it, the
    // screenshot's springs take it unscaled
    const frameScale = Math.min(clock.getDelta() * 60, 2);
    simMaterial.uniforms.dtScale.value = frameScale * SIM_SPEED;
    // follows the ship to attractor tween so the mouse stays the same size
    // relative to the cloud the whole way through
    simMaterial.uniforms.cloudRadius.value = rig.radius;

    updateCameraFraming(camera);

    // only step and draw the screenshot when its panel is on screen. it's a
    // million particles of its own on top of the ship's million
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
    
    // setFromCamera reads the projection matrix, so the rig's view offset is
    // already in it, and the world matrix is current from the render above
    raycaster.setFromCamera(pointer, camera);
    simMaterial.uniforms.mouseOrigin.value.copy(raycaster.ray.origin);
    simMaterial.uniforms.mouseDir.value.copy(raycaster.ray.direction);
    // the cloud is centred on the origin, so this is how far off the thing the
    // cursor's radius is measured against sits
    simMaterial.uniforms.mouseDepth.value = Math.max(camera.position.length(), 0.001);
    simMaterial.uniforms.mouseActive.value = pointerActive ? 1.0 : 0.0;
  }

  main()
// the sim material is built behind the GLB load and the gpu tier probe, so
// everything that drives it has to reach in through here rather than import it
export function getSimMaterial() {
  return simMaterial;
}

// how many particles the sim texture holds, 1,048,576 on desktop
export function getParticleTotal() {
  return particleTotal;
}

// the counts the slider stops on, clamped to what this device's texture can
// supply. mobile's only holds 65k so it gets the low steps
export function getParticleSteps() {
  const steps = PARTICLE_STEPS.filter((count) => count <= particleTotal);
  // if the round steps stop well short of the texture, add the real total so
  // the top of the slider is actually the top
  if (!steps.length || steps[steps.length - 1] < particleTotal * 0.9) {
    steps.push(particleTotal);
  }
  return steps;
}

export function getDefaultParticleCount() {
  return defaultParticleCount;
}

// draws a prefix of the particle buffer rather than all of it. the sim still
// steps every particle, so this is a render cost control and not a sim one. a
// prefix is a fair sample because samplePositions walks the mesh in random order
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
    
  