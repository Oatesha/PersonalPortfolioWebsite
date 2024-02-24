import './style.css'

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { vertexShader } from './glsl/main.vertFBO.js';
import { fragmentShader } from './glsl/simfragFBO.js';
import { fragPosSimShader } from './glsl/FBOAttemptPos.frag.js';
import { fragVelSimShader } from './glsl/FBOAttemptVel.frag.js';


import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';
import { GPUComputationRenderer } from 'three/addons/misc/GPUComputationRenderer.js';



// Set up scene
const scene = new THREE.Scene();

// Set up camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 3000);
camera.position.z = 200;

// Set up renderer
const renderer = new THREE.WebGLRenderer({
  canvas: document.querySelector('#Background'),
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
const controls = new OrbitControls(camera, renderer.domElement);

// Create lights

const ambientLight = new THREE.AmbientLight(0xffff00, 0.5);
scene.add(ambientLight);

renderer.setClearColor(0xDBE9EE, 1);


// pixel res of texture whatever this is squared is the amount of particles we'll have
const simulationMatSize = 512;

function initEvents() {
  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    
  });
  
  // window.addEventListener('pointermove', onPointerMove);
  
}

let gpuCompute;
let velocityVariable;
let positionVariable;
let positionUniforms;
let velocityUniforms;
let materialUniforms;
let lastTime = performance.now();
let mouseX = 0, mouseY = 0;

function initGGPU() {






  gpuCompute = new GPUComputationRenderer(simulationMatSize, simulationMatSize, renderer);
  const changePosition = gpuCompute.createTexture();
  const changeVelocity = gpuCompute.createTexture();

  initialiseTexturePos(changePosition);
  initialiseVelocityPos(changeVelocity);

  positionVariable = gpuCompute.addVariable('texturePosition', fragPosSimShader, changePosition);
  velocityVariable = gpuCompute.addVariable('textureVelocity', fragPosSimShader, changeVelocity);

  gpuCompute.setVariableDependencies( velocityVariable, [ positionVariable, velocityVariable ] );
  gpuCompute.setVariableDependencies( positionVariable, [ positionVariable, velocityVariable ] );


  positionUniforms = positionVariable.material.uniforms;
  positionUniforms[ 'time' ] = {value: 0.0};
  positionUniforms[ 'delta' ] = {value: 0.0};
  positionVariable.wrapS = THREE.RepeatWrapping;
  positionVariable.wrapT = THREE.RepeatWrapping;

  velocityUniforms = velocityVariable.material.uniforms;
  velocityUniforms[ 'time' ] = {value: 1.0};
  velocityUniforms[ 'delta' ] = {value: 0.0};

  velocityVariable.wrapS = THREE.RepeatWrapping;
  velocityVariable.wrapT = THREE.RepeatWrapping;

  gpuCompute.init();
  
}


function initialiseTexturePos(texture) {

  let posArray = texture.image.data;
  for (let i = 0; i < posArray.length; i += 4) {
      posArray[i] = Math.random() * 10; 
      posArray[i+1] = Math.random() * 10;
      posArray[i+2] = Math.random() * 10;
      posArray[i+3] = 1.0;
  }
}

function initialiseVelocityPos(texture) {

  let velArray = texture.image.data;
  for (let i = 0; i < velArray.length; i += 4) {
      velArray[i] = Math.random() * 10; 
      velArray[i+1] = Math.random() * 10;
      velArray[i+2] = Math.random() * 10;
      velArray[i+3] = 1.0;
  }
}

materialUniforms = {
  'time': { value: 1.0 },
  'delta': { value: 0.0},
  'texturePosition': { value: null },
  'textureVelocity': { value: null },
};



const material = new THREE.ShaderMaterial({
  side: THREE.DoubleSide,
  uniforms: materialUniforms,
  vertexShader: vertexShader,
  fragmentShader: fragmentShader,
})

// fill vertices arrays
const geometry = new THREE.BufferGeometry();
let vertices = new Float32Array(simulationMatSize * simulationMatSize * 3);
let particleRef = new Float32Array(simulationMatSize * simulationMatSize * 2); 
for (let i = 0; i < simulationMatSize * simulationMatSize; i++) {
  vertices.set([Math.random() - 0.5, Math.random() - 0.5, Math.random()- 0.5], i * 3)

  const x = ( i % simulationMatSize ) / simulationMatSize;
  const y = ~ ~ ( i / simulationMatSize ) / simulationMatSize;
  particleRef.set([x, y], i * 2)
}
geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3))
geometry.setAttribute('references', new THREE.BufferAttribute(particleRef, 2))


const mesh = new THREE.Points(geometry, material);

scene.add(mesh);

let clock = new THREE.Clock();
  
renderer.setAnimationLoop((_) => {
  const t = performance.now();
  // elapsedTime.time.value = t;
  let delta = (t - lastTime) / 1000;
  

  positionUniforms['time'].value = t;
  positionUniforms['delta'].value = delta;
  materialUniforms['time'].value = t;
  materialUniforms['delta'].value = delta;
  
  gpuCompute.compute();
  
  materialUniforms['texturePosition'].value = gpuCompute.getCurrentRenderTarget( positionVariable ).texture;
  materialUniforms['textureVelocity'].value = gpuCompute.getCurrentRenderTarget( velocityVariable ).texture;
  controls.update();
  renderer.render(scene, camera);
});

function initRenderTarget() {
  const renderTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    format: THREE.RGBAFormat,
    type: THREE.FloatType,
  });
  return renderTarget;
}


initGGPU();
initEvents();