import * as THREE from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import {TextGeometry} from 'three/addons/geometries/TextGeometry.js' 
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';
import { vertexShader } from './glsl/main.vertFBO.js';
import { fragmentShader } from './glsl/main.fragFBO.js';
import { simvertFBO } from './glsl/simvertFBO.js';
import { simfragFBO } from './glsl/simfragFBO.js';
import { imageVertexShader } from './glsl/imageVertexShader.js';
import { imageFragmentShader } from './glsl/imageFragmentShader.js';
import { GLTFLoader } from 'three/examples/jsm/Addons.js';
import gsap from 'gsap';
import { initAnim } from './animation.js';
import { getGPUTier } from 'detect-gpu';
import { rig, initRig, setRigTarget, updateCameraFraming } from './cameraRig.js';
import './menu.js';
import './attractors.js';

const root = document.documentElement;
root.dataset.theme = 'dark';

let canvasBoundingRect, imageMat, sampler, projectImageSection, renderMaterial, simMaterial,
 shipMesh, renderTargetA, renderTargetB, fbo, img

export const camera = new THREE.PerspectiveCamera(50, window.innerWidth/window.innerHeight, 0.001, 1000);
export const mobile = detectMob();

// main simulation variables
const renderer = new THREE.WebGLRenderer({alpha: true});
const simScene = new THREE.Scene();


// image rendering variables
const imageRenderer = new THREE.WebGLRenderer({ alpha: true });
const imageScene = new THREE.Scene();
// orthographic over a unit quad. the image is fitted to the box in the shader
// from the two aspects, so the camera needs no aspect of its own and nothing
// has to be recomputed when the window changes shape
const imagecam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 10);
imagecam.position.z = 1;

// mouse event variables
const pointer = new THREE.Vector2();
const imagePointer = new THREE.Vector2();
const prevImagePointer = new THREE.Vector2();
const raycaster = new THREE.Raycaster();

// The pointer is projected onto the z=0 plane to drive the simulation's mouse
// repulsion. A maths plane does this without geometry, a material or a mesh.
const mousePlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const mouseHit = new THREE.Vector3();

let imageSectionVisible = true;

const textureLoader = new THREE.TextureLoader();
const loadedTextures = [];

// list of textures in order of project pos-index 0 through to max length
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
  initImageMesh();
  preloadTextures();
  initEvents()
  loadModelGeometries();
}

// Uncapped devicePixelRatio costs 9x the fragment work on a 3x display for no
// visible gain on a particle field, so clamp it.
const MAX_PIXEL_RATIO = 2;

// Simulation rate, in 60Hz frames per real frame. Making the sim frame-rate
// independent pinned it to 60Hz, which is a lot slower than the 144Hz the look
// had actually been tuned against, so the speed is asked for explicitly rather
// than inherited from whatever the display happens to do. 2.4 == 144/60, i.e.
// the motion a 144Hz display used to get, now on every display.
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
    setImageRendererSize();

    // The box is sized by the grid, which reflows for reasons a window resize
    // listener never sees, so observe the element itself.
    new ResizeObserver(setImageRendererSize).observe(projectImageSection);

    new IntersectionObserver((entries) => {
      imageSectionVisible = entries[0].isIntersecting;
    }).observe(projectImageSection);
  }
}

function preloadTextures() {
  textures.forEach((textureUrl, index) => {
    if (textureUrl !== "None") {
      textureLoader.load(
        textureUrl,
        (texture) => {
          texture.needsUpdate = true;
          loadedTextures[index] = texture;
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

  // Element width and height minus padding and border
  var elementWidth = box.offsetWidth - paddingX - borderX;
  var elementHeight = box.offsetHeight - paddingY - borderY;

  if (elementWidth < 1 || elementHeight < 1) {
    return;
  }

  imageRenderer.setPixelRatio(currentPixelRatio());
  imageRenderer.setSize(elementWidth, elementHeight);

  if (imageMat) {
    imageMat.uniforms.u_planeAspect.value = elementWidth / elementHeight;
  }

  refreshCanvasBoundingRect();
}

function onPointerMove( event ) {

  pointer.x = ( event.clientX / window.innerWidth ) * 2 - 1;
  pointer.y = - ( event.clientY / window.innerHeight ) * 2 + 1;

  prevImagePointer.x = imagePointer.x;
  prevImagePointer.y = imagePointer.y;

  // divide by the canvas boudning box so that the pointer works for just the image
  if (canvasBoundingRect) {
    imagePointer.x = (((event.clientX - canvasBoundingRect.left) / (canvasBoundingRect.width)));
    imagePointer.y = (1 - ((event.clientY - canvasBoundingRect.top) / (canvasBoundingRect.height)));
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
  
function initImageMesh() {
  // Fills the orthographic frustum exactly. The image is fitted inside it by
  // the shader, so the quad never needs rescaling per texture or per window.
  const imageGeo = new THREE.PlaneGeometry(2, 2);

  imageMat = new THREE.ShaderMaterial({
    transparent: true,
    uniforms: {
      u_texture: { value: null },
      u_Mouse: { value: new THREE.Vector2() },
      u_PrevMouse: { value: new THREE.Vector2() },
      u_aberrationIntensity: { value: 1.0 },
      u_planeAspect: { value: 1.0 },
      u_texAspect: { value: 1.0 },
    },
    vertexShader: imageVertexShader,
    fragmentShader: imageFragmentShader,
  })

  var image = new THREE.Mesh(imageGeo, imageMat);

  textureLoader.load(textures[0], (tex) => {
    tex.needsUpdate = true;
    imageMat.uniforms.u_texture.value = tex;
    imageMat.uniforms.u_texAspect.value = tex.image.width / tex.image.height;
  });

  imageScene.add(image);
}

function loadModelGeometries() {
  // const loader = new FontLoader();
  // loader.load( '/Epilogue Medium_Regular.json', 
  // function ( font ) {

  //   var textGeometry = new TextGeometry('Harrison', {
  //     size: 10,
  //     height: 0,
  //     font: font,
  //     style: 'normal',
  //     bevelSize: 0.25,
  //     bevelThickness: 0.50,
  //     bevelEnabled: true,
  //   });  

    const modelLoader = new GLTFLoader();
    modelLoader.load( 'models/radiant_pillar_baked.glb', function ( gltf ) {
      gltf.scene.traverse((child) => {
        if (child.isMesh) {
          shipMesh = child.clone();
          shipMesh.geometry = child.geometry.clone();
          shipMesh.geometry.center()
          shipMesh.geometry.scale(0.085, 0.085, 0.085);

          // The rig frames the camera against the model's actual extent rather
          // than a hardcoded distance, so it needs the bounding volume. The
          // sphere sets the overall scale that the animations tween; the box
          // gives the silhouette, which for a flat model like this ship is much
          // smaller than the sphere on two of three axes.
          shipMesh.geometry.computeBoundingSphere();
          shipMesh.geometry.computeBoundingBox();
          const { radius } = shipMesh.geometry.boundingSphere;
          const halfExtent = shipMesh.geometry.boundingBox.getSize(new THREE.Vector3()).multiplyScalar(0.5);
          rig.radius = radius;
          // Mutated rather than replaced: the middle page timeline tweens this
          // object, so swapping it out would leave the tween writing to a
          // detached one.
          rig.extent.x = halfExtent.x / radius;
          rig.extent.y = halfExtent.y / radius;
          rig.extent.z = halfExtent.z / radius;
        }
      });
  
      initFBO();
    }, undefined, function ( error ) {

    console.error( error );
    });
}
  
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

// Function to sample positions and return them as an array of Vector3
function samplePositions(numSamples, Mesh) {
  let positions = [];

  // Build a Mesh Surface Sampler to sample positions from the geometry
  sampler = new MeshSurfaceSampler(Mesh).build();
  for (let i = 0; i < numSamples; i++) {
    let position = new THREE.Vector4();
    let normals = new THREE.Vector3();
    let colour = new THREE.Vector3();

    sampler.sample(position, normals, colour);

    // pack rgb values as three 8 bit integers 0-255 into the 4th float of the vector so that they can fit into the alpha channel of the data texture
    // Likely I've messed something up here but looks the same in blender
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
  let w = mobile ? 256 : 256 * Math.pow(2, gputier.tier);
  let h = w;

  // init positions in data texture used if i want a circle that eventually becomes the model
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

  // Number of initial positions to sample
  const numInitialPositions = w * h;

  // Sample initial positions
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
  
  // init simulation mat with above created data texture
  simMaterial = new THREE.ShaderMaterial({
    uniforms: {
      state: { value: 0 },
      maxDist: { value: 1.0 },
      time: {value: 0.0},
      dtScale: {value: 1.0},
      // idle sits at morph 1, fully arrived at attractorTo
      attractorFrom: {value: 0},
      attractorTo: {value: 0},
      morph: {value: 1.0},
      cloudRadius: {value: 1.0},
      mixValue: {value: 1.0},
      posTex: { value: initialCircleDataTex },
      shipPosTex: { value: initialShipDataTex },
      mouse: { value : new THREE.Vector2(-100,-100) },
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
  
  // scene to render simulation texture so that we can 'ping-pong' the renderer between different render targets to update positions 
  fbo = new FBO(w, simMaterial);
  
  // create sim render target
  renderTargetA = new THREE.WebGLRenderTarget(w, h, {
    wrapS: THREE.RepeatWrapping,
    wrapT: THREE.RepeatWrapping,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    format: THREE.RGBAFormat,
    type: THREE.FloatType,
    stencilBuffer: false,
  });
  
  // a second render target lets us store prev input + current output states
  renderTargetB = renderTargetA.clone();
  
  renderer.setRenderTarget(renderTargetA),
  renderer.clear(),
  renderer.render(fbo.scene, fbo.camera),
  renderer.setRenderTarget(renderTargetB),
  renderer.clear(),
  renderer.render(fbo.scene, fbo.camera),
  renderer.setRenderTarget(null)
    
  renderMaterial = new THREE.ShaderMaterial({
    uniforms: { posTex: { value: null },
    // static, and the only place the ship's sampled colours are read from
    shipPosTex: { value: initialShipDataTex },
    mouse: { value : new THREE.Vector2(10,10)},
    // uTexture: {value: texture},
    pointSize: { value: 2.0 },
    colourMix: { value: 0.0 },
    u_time: {value: 1.0}},
    vertexShader: vertexShader,
    fragmentShader: fragmentShader,
  });
  
  var particleGeometry = new THREE.BufferGeometry();
  let positions = new Float32Array((w * w) * 3);
  let uvs = new Float32Array((w * w) * 2);
  // Each particle stores the coordinate of the simulation texel it reads from in
  // its position attribute, which main.vertFBO samples with texture2D(posTex, position.xy).
  // Sample texel centres so NearestFilter cannot land on a texel boundary.
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
    
    var points = new THREE.Points(particleGeometry, renderMaterial);
    simScene.add(points);
    renderMaterial.uniforms.posTex.value = initialShipDataTex;

    // on gsap's ticker rather than its own raf, so scrolling, tweening and
    // rendering advance on one clock in a fixed order instead of racing
    gsap.ticker.add(render);
    initAnim();
  }
  
  const clock = new THREE.Clock();
  let elapsed = 0;

  function render() {
    // A backgrounded tab still gets throttled frames on some browsers, and
    // there is nothing to see, so skip the two render passes entirely.
    if (document.hidden) {
      return;
    }

    // getElapsedTime consumes the delta internally, so take the delta once and
    // accumulate. The simulation steps by dtScale rather than a fixed amount,
    // so it runs at the same rate on a 60Hz and a 144Hz display instead of
    // 2.4x faster on the latter. Capped so a dropped frame cannot blow up the
    // chaotic attractor.
    const delta = clock.getDelta();
    elapsed += delta;
    simMaterial.uniforms.time.value = elapsed;
    simMaterial.uniforms.dtScale.value = Math.min(delta * 60, 2) * SIM_SPEED;
    // Follows the ship-to-attractor tween, so the mouse stays the same size
    // relative to the cloud the whole way through it.
    simMaterial.uniforms.cloudRadius.value = rig.radius;

    updateCameraFraming(camera);

    // Only draw the screenshot when its panel is actually on screen.
    if (imageSectionVisible) {
      imageRenderer.render(imageScene, imagecam);
    }

    // Swap renderTargetA and renderTargetB
    var temp = renderTargetA;
    renderTargetA = renderTargetB;
    renderTargetB = temp;
    simMaterial.uniforms.posTex.value = renderTargetA.texture;
    renderer.setRenderTarget(renderTargetB);
    renderer.render(fbo.scene, fbo.camera);
    renderer.setRenderTarget(null);
    renderMaterial.uniforms.posTex.value = renderTargetB.texture;
    
    renderer.render(simScene, camera);
    
    // Intersect the z=0 plane directly. This used to raycast against a 512x512
    // Mesh built only to stand in for that plane, and allocated a Vector2 every
    // frame for the result.
    raycaster.setFromCamera(pointer, camera);
    if (raycaster.ray.intersectPlane(mousePlane, mouseHit)) {
      simMaterial.uniforms.mouse.value.set(mouseHit.x, mouseHit.y);
    }

    imageMat.uniforms.u_PrevMouse.value.set(
      prevImagePointer.x,
      prevImagePointer.y,
    )
    
    imageMat.uniforms.u_Mouse.value.set(
      imagePointer.x,
      imagePointer.y,
    )
  }

  main()
// Export a function to get the simMaterial instance
export function getSimMaterial() {
  return simMaterial;
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
  }

  const texture = loadedTextures[index];
  imageMat.uniforms.u_texture.value = texture;
  imageMat.uniforms.u_texture.needsUpdate = true;
  // Screenshots are not all the same shape, and the shader fits by aspect.
  imageMat.uniforms.u_texAspect.value = texture.image.width / texture.image.height;
}
    
  