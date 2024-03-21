
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import {TextGeometry} from 'three/addons/geometries/TextGeometry.js' 
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';
import { vertexShader } from './glsl/main.vertFBO.js';
import { fragmentShader } from './glsl/main.fragFBO.js';
import { simvertFBO } from './glsl/simvertFBO.js';
import { simfragFBO } from './glsl/simfragFBO.js';
import { GUI } from 'dat.gui';
import gsap from 'gsap';



// // Create an instance of the Stats object
// const stats = new Stats();

// // Add the Stats object to the HTML document
// document.body.appendChild(stats.dom);

// Create a new dat.GUI instance
const gui = new GUI();
const root = document.documentElement;
root.dataset.theme = 'dark';

let renderTargetB, renderTargetA, h, simMaterial, renderMaterial, fbo, points, textGeometry;

let scene = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(50, window.innerWidth/window.innerHeight, 0.001, 30000);
const renderer = new THREE.WebGLRenderer({alpha: true});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild( renderer.domElement );




// renderer.setClearColor(0x0A0A09);
renderer.setClearColor(0x000000, 0);

const pointer = new THREE.Vector2();
const raycaster = new THREE.Raycaster();

const dummyGeom = new THREE.PlaneGeometry(512, 512);
const dummyMat = new THREE.MeshPhongMaterial({color: 0xFFFFFF});
const dummyObject = new THREE.Mesh(dummyGeom, dummyMat);
// scene.add(dummyObject);
dummyObject.position.set (0, 0, 0);

// background div 
const backgroundAnim = document.querySelector(".BackgroundAnimation");
const blurHtml = document.querySelector(".Blur");


function initEvents() {
  window.addEventListener( 'resize', onWindowResize, false );
  // Listen for scroll event on the window
  window.addEventListener('scroll', handleScroll);

  function handleScroll() {
    // console.log("scrolling");

    moveBackgroundAnim((pointer.x + 1) / 2 * window.innerWidth, -(pointer.y - 1) / 2 * window.innerHeight, true);
  }

  function onWindowResize(){

    camera.aspect = window.innerWidth / window.innerHeight;
    // camera.left = ( (window.innerWidth)) / -150;
    // camera.right = ((window.innerWidth)) / 150;
    camera.updateProjectionMatrix();

    renderer.setSize( window.innerWidth, window.innerHeight );
    initHtml();

  }

  document.addEventListener( 'pointermove', onPointerMove );

  function onPointerMove( event ) {

    pointer.x = ( event.clientX / window.innerWidth ) * 2 - 1;
    pointer.y = - ( event.clientY / window.innerHeight ) * 2 + 1;

    
    moveBackgroundAnim(event.clientX, event.clientY, false);


  }

  initHtml();

  const loader = new FontLoader();
  loader.load( 'Epilogue Medium_Regular.json', 
  function ( font ) {

    textGeometry = new TextGeometry('Harrison', {
      size:10,
      height:0,
      font:font,

      style:'normal',
      bevelSize:0.25,
      bevelThickness:0.50,
      bevelEnabled:true,
    });
    initFBO();
  });
  
  
}  
let scrollLeft = 0, scrollTop = 0;

let tweenX = gsap.quickTo(backgroundAnim, "left", { duration: 0.4, ease: "power3" }),
tweenY = gsap.quickTo(backgroundAnim, "top", { duration: 0.4, ease: "power3" });

function moveBackgroundAnim(x, y, scrolling) {
  if (scrolling) {
    // console.log("scrolling update");
    scrollLeft = (window.scrollX !== undefined) ? window.scrollX : (document.documentElement || document.body.parentNode || document.body).scrollLeft;
    scrollTop = (window.scrollY !== undefined) ? window.scrollY : (document.documentElement || document.body.parentNode || document.body).scrollTop;  
  }
  tweenX(x + scrollLeft);
  tweenY(y + scrollTop);

  
}

function initHtml() {
  // Get canvas element and its dimensions
  var canvas = renderer.domElement;
  var canvasWidth = canvas.width;
  var canvasHeight = canvas.height;




  var element1 = document.querySelector(".LandingPageContent");

  var centerY = canvasHeight / 2; // 50% of canvas height

  // Set CSS style to position elements
  element1.style.position = "absolute";
  // element1.style.left = centerX + "px";
  element1.style.height = (canvasHeight * 0.2321) + 0.2321 * canvasHeight + "px";
  element1.style.top = (centerY) - ((canvasHeight * 0.2321) + 0.2321 * canvasHeight) / 2 + "px";

  // width is canvasheight * 1.232 half that width exists on the left of the center so left needs to be that
  element1.style.left = ((canvasWidth - (canvasHeight * 1.232)) / 2) -2.5 + "px";

  // console.log(((canvasWidth - (canvasHeight * 1.232)) / 2) + " " + (centerY - ((canvasHeight * 0.2321) + 200) / 2));

}

function initFBO() {
  // verify browser can support float textures
  if (!renderer.capabilities.floatVertexTextures) {
    alert(' * Browser does not support float vertex and fragment shaders');
  }
  
  
  let w = h = 1024;
  
  // init positions in data texture
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
      initPos[index + 3] =  1.0; // this value will not have any impact
    }
  }
  
  // init positions in data texture
  let cubePos = new Float32Array(w * h * 4);
  for (let i = 0; i < w; i++) {
    for (let j = 0; j < w; j++) {
      let index = (i + j * w) * 4;
      
      cubePos[index] = 5 * Math.random();
      cubePos[index + 1] =  5 * Math.random();
      cubePos[index + 2] = (Math.random() ),
      cubePos[index + 3] = 1.0;
    }
  }
  
  
  // Set up a geometry to sample positions from
  textGeometry.center();
  let mesh = new THREE.Mesh(textGeometry);

  // Build a Mesh Surface Sampler to sample positions from the geometry
  let sampler = new MeshSurfaceSampler(mesh).build();

  // Function to sample positions and return them as an array of Vector3
  function samplePositions(numSamples) {
    let positions = [];
    for (let i = 0; i < numSamples; i++) {
      let position = new THREE.Vector3();
      sampler.sample(position);
      positions.push(position);
    }
    return positions;
  }

  // Number of initial positions to sample
  const numInitialPositions = w * h;
  // Sample initial positions
  let initialPositions = samplePositions(numInitialPositions);

  // Convert initial positions to Float32Array for use in DataTexture
  let initialPositionsArray = new Float32Array(numInitialPositions * 4);
  initialPositions.forEach((position, index) => {
    initialPositionsArray[index * 4] = position.x;
    initialPositionsArray[index * 4 + 1] = position.y;
    initialPositionsArray[index * 4 + 2] = position.z;
    initialPositionsArray[index * 4 + 3] = 1.0;
  });

  let dataTex = new THREE.DataTexture(initPos, w, h, THREE.RGBAFormat, THREE.FloatType);
  let textDataTex = new THREE.DataTexture(initialPositionsArray, w, h, THREE.RGBAFormat, THREE.FloatType);
  
  
  // let dataTex = new THREE.DataTexture(texture.image, w, h, THREE.RGBAFormat, THREE.FloatType);
  dataTex.minFilter = THREE.NearestFilter;
  dataTex.magFilter = THREE.NearestFilter;
  dataTex.needsUpdate = true;

  // let dataTex = new THREE.DataTexture(texture.image, w, h, THREE.RGBAFormat, THREE.FloatType);
  textDataTex.minFilter = THREE.NearestFilter;
  textDataTex.magFilter = THREE.NearestFilter;
  textDataTex.needsUpdate = true;
  
  // init simulation mat with above created data texture
  // Export the simMaterial
  simMaterial = new THREE.ShaderMaterial({
    uniforms: { 
      posTex: { value: dataTex },
      maxDist: { value: 1.0 },
      time: {value: 0.0},
      mixValue: {value: 1.0},
      originalPosTex: { value: dataTex },
      textPosTex: { value: textDataTex }, 
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
  
  // create render targets a + b to which the simulation will be rendered
  renderTargetA = new THREE.WebGLRenderTarget(w, h, {
    wrapS: THREE.RepeatWrapping,
    wrapT: THREE.RepeatWrapping,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    format: THREE.RGBAFormat,
    type: THREE.FloatType,
    stencilBuffer: false,
  });
  
  // a second render target lets us store input + output positional states
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
    u_time: {value: 1.0}},
    vertexShader: vertexShader,
    fragmentShader: fragmentShader,
  });
  
  var geometry = new THREE.BufferGeometry();
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
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    
    points = new THREE.Points(geometry, renderMaterial);
    scene.add(points);
    renderMaterial.uniforms.posTex.value = dataTex;
    // Add a slider for the time uniform
    gui.add(simMaterial.uniforms.mixValue, 'value', 0.0, 1.0, 0.05).name('mixValue');
    render()
  }
  
  const clock = new THREE.Clock();

  function render() {
    requestAnimationFrame(render);


    simMaterial.uniforms.time.value = clock.getElapsedTime();
    // Swap renderTargetA and renderTargetB
    var temp = renderTargetA;
    renderTargetA = renderTargetB;
    renderTargetB = temp;
    simMaterial.uniforms.posTex.value = renderTargetA.texture;
    renderer.setRenderTarget(renderTargetB);
    renderer.render(fbo.scene, fbo.camera);
    renderer.setRenderTarget(null);
    renderMaterial.uniforms.posTex.value = renderTargetB.texture;
    
    renderer.render(scene, camera);
    
    raycaster.setFromCamera(pointer, camera);
    
    let intersects = raycaster.intersectObject(dummyObject);
    if (intersects.length > 0) {
      let {x,y} = intersects[0].point;
      simMaterial.uniforms.mouse.value = new THREE.Vector2(x,y);
    }
    
    // Request the next frame
    
    
  }
  

  initEvents();

// Export a function to get the simMaterial instance
export function getSimMaterial() {
  return simMaterial;
}
  
  
    // function parseMesh(geometry) {
    //   const positionArray = textGeometry.attributes.position.array;
    //   const totalVertices = positionArray.length;
    //   const size = parseInt(Math.sqrt(totalVertices * 3) + .5);
    //   const data = new Float32Array(size * size * 4);
  
    //   for (var i = 0; i < totalVertices; i++) {
    //       data[i * 4] = vertices[i * 4];
    //       data[i * 4 + 1] = vertices[i * 4 + 1];
    //       data[i * 4 + 2] = vertices[i * 4 + 2];
    //       data[i * 4 + 3] = vertices[i * 4 + 3]; // Alpha component
    //   }
  
    //   return {data, size};
    // }
    
  