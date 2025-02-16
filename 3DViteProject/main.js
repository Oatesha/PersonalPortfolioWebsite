import * as THREE from 'three';
import { MathUtils } from 'three';
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
const imagecam = new THREE.PerspectiveCamera(100, window.innerWidth/window.innerHeight, 0.001, 30000);
imagecam.aspect = window.innerWidth / window.innerHeight;
imagecam.updateProjectionMatrix();

// mouse event variables
const pointer = new THREE.Vector2();
const imagePointer = new THREE.Vector2();
const prevImagePointer = new THREE.Vector2();
const raycaster = new THREE.Raycaster();

const dummyGeom = new THREE.PlaneGeometry(512, 512);
const dummyMat = new THREE.MeshPhongMaterial({color: 0xFFFFFF});
const dummyObject = new THREE.Mesh(dummyGeom, dummyMat);
dummyObject.position.set (0, 0, 0);

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
  initHtml();
  initImageScene();
  initImageMesh();
  preloadTextures();
  initEvents()
  loadModelGeometries();
}

function initScene() {  
  renderer.setPixelRatio(window.devicePixelRatio);
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
    projectImageSection.appendChild(imageRenderer.domElement);
    setImageRendererSize();
    adjustCameraFov();
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
  
  // https://stackoverflow.com/questions/25197184/get-the-height-of-an-element-minus-padding-margin-border-widths
  var cs = getComputedStyle(projectImageSection);
  var paddingX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
  var paddingY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
  
  var borderX = parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth);
  var borderY = parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
  
  // Element width and height minus padding and border
  var elementWidth = projectImageSection.offsetWidth - paddingX - borderX;
  var elementHeight = projectImageSection.offsetHeight - paddingY - borderY;
  console.log(elementWidth);
  console.log(elementHeight);
  imageRenderer.setSize(elementWidth, elementHeight, false);
}

// https://discourse.threejs.org/t/keeping-an-object-scaled-based-on-the-bounds-of-the-canvas-really-battling-to-explain-this-one/17574/10
function adjustCameraFov() {
  const fov = 100;
  const planeAspectRatio = 21/9;
  imagecam.aspect = window.innerWidth / window.innerHeight;
  
  if (imagecam.aspect > planeAspectRatio) {
		imagecam.fov = fov;
	} 
  else {
		// window too narrow
		const cameraHeight = Math.tan(MathUtils.degToRad(fov / 2));
		const ratio = imagecam.aspect / planeAspectRatio;
		const newCameraHeight = cameraHeight / ratio;
		imagecam.fov = MathUtils.radToDeg(Math.atan(newCameraHeight)) * 2;
	}
  imagecam.updateProjectionMatrix();
}

function onPointerMove( event ) {

  pointer.x = ( event.clientX / window.innerWidth ) * 2 - 1;
  pointer.y = - ( event.clientY / window.innerHeight ) * 2 + 1;

  prevImagePointer.x = imagePointer.x;
  prevImagePointer.y = imagePointer.y;

  // divide by the canvas boudning box so that the pointer works for just the image
  imagePointer.x = (((event.clientX - canvasBoundingRect.left) / (canvasBoundingRect.width)));
  imagePointer.y = (1 - ((event.clientY - canvasBoundingRect.top) / (canvasBoundingRect.height)));
  
  moveBackgroundAnim(event.clientX, event.clientY, false);
}

function initEvents() {

  document.addEventListener( 'pointermove', onPointerMove );

  // hacky
  canvasBoundingRect = document.querySelector('[status="active"]').childNodes[1].childNodes[0].getBoundingClientRect();

  window.addEventListener( 'resize', onWindowResize, false );
  window.addEventListener('scroll', handleScroll);
}

function handleScroll() {
  moveBackgroundAnim((pointer.x + 1) / 2 * window.innerWidth, -(pointer.y - 1) / 2 * window.innerHeight, true);
  
  var activeSection = document.querySelector('[status="active"]')
  if (activeSection.getAttribute('pos-index') == 1 || mobile) {
    return;
  }

  canvasBoundingRect = activeSection.childNodes[1].querySelector("canvas").getBoundingClientRect();
}
  
function onWindowResize(){

  camera.aspect = window.innerWidth / window.innerHeight;
  renderer.setSize( window.innerWidth, window.innerHeight );
  setImageRendererSize();
  initHtml();

}
  
function initImageMesh() {
  const imageGeo = new THREE.PlaneGeometry(21, 9);

  imageGeo.center();
  imageMat = new THREE.ShaderMaterial({
    uniforms: {
      u_texture: { type: "t", value: null },
      u_Mouse: { type: "v2", value: new THREE.Vector2() },      
      u_PrevMouse: { type: "v2", value: new THREE.Vector2() },
      u_aberrationIntensity: { type: "f", value: 1.0 },    

    },
    vertexShader: imageVertexShader,
    fragmentShader: imageFragmentShader,
  })
  
  var image = new THREE.Mesh(imageGeo, imageMat);
  
  textureLoader.load("/Minecraftle.png", (tex) => {
    tex.needsUpdate = true;
    imageMat.uniforms.u_texture.value = tex
    const boxSize = 1.0;
    const ratio = tex.image.height / tex.image.width;
    image.scale.set(boxSize * ratio, boxSize * ratio, 1.0)
  });

  imageScene.add(image);
  imagecam.position.set(0, 0, 1.5);
  imagecam.lookAt(0, 0, 0);
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
          console.log(shipMesh)
          shipMesh.geometry.center()
          shipMesh.geometry.scale(0.085, 0.085, 0.085);
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

function initHtml() {

  var element1 = document.querySelector(".LandingPageContent");
  element1.style.position = "absolute";
  
  if (mobile) {
    element1.style.top = "20%";
    element1.style.left = "5%";

    element1.style.height = "60%"
    return;
  }
  
  // Get canvas element and its dimensions
  var canvas = renderer.domElement;
  var canvasWidth = canvas.width;
  var canvasHeight = canvas.height;

  element1.style.height = "90%"
  element1.style.top =  "5%";


  // width is canvasheight * 1.232 half that width exists on the left of the center so left needs to be half that
  element1.style.left = ((canvasWidth - (canvasHeight * 1.232)) / 2) -2.5 + "px";
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
    alert(' * Browser does not support float shaders particles will not render properly');
  }
  
  if (mobile) {
    alert("For the best viewing experience with all the features please view on desktop");
  }

  let gputier = await getGPUTier();
  console.log(gputier);
  let w = mobile ? 256 : 256 * Math.pow(2, gputier.tier);
  // let w = 2;
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
      posTex: { value: initialShipDataTex },
      state: { value: 0 },
      maxDist: { value: 1.0 },
      time: {value: 0.0},
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
    mouse: { value : new THREE.Vector2(10,10)},
    // uTexture: {value: texture}, 
    pointSize: { value: 2.0 },
    u_time: {value: 1.0}},
    vertexShader: vertexShader,
    fragmentShader: fragmentShader,
  });
  
  var particleGeometry = new THREE.BufferGeometry();
  let positions = new Float32Array((w * w) * 3);
  let uvs = new Float32Array((w * w) * 2);
  for (let i = 0; i < w; i++) {
    
    for (let j = 0; j < w; j++) {
      
      let index = (i + j * w);
      positions[index] = Math.random();
      positions[index + 1] = 1.0;
      positions[index + 2] = 1.0;
      uvs[index] = i / w
      uvs[index + 1] = j / w; 
    }
  }
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    
    var points = new THREE.Points(particleGeometry, renderMaterial);
    simScene.add(points);
    renderMaterial.uniforms.posTex.value = initialShipDataTex;

    render();
    initAnim();
  }
  
  const clock = new THREE.Clock();
  function render() {
    requestAnimationFrame(render);
    simMaterial.uniforms.time.value = clock.getElapsedTime();
    imageRenderer.render(imageScene, imagecam);

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
    
    raycaster.setFromCamera(pointer, camera);
    
    let intersects = raycaster.intersectObject(dummyObject);
    if (intersects.length > 0) {
      let {x,y} = intersects[0].point;
      simMaterial.uniforms.mouse.value = new THREE.Vector2(x,y);
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

  imageMat.uniforms.u_texture.value = loadedTextures[index];
  imageMat.uniforms.u_texture.needsUpdate = true;

}
    
  