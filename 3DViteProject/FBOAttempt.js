import './style.css'

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { vertexShader } from './glsl/main.vert.js';
import { fragmentShader } from './glsl/main.frag.js';
import { fragSimShader } from './glsl/FBOAttempt.frag.js';
import { vertSimShader } from './glsl/FBOAttempt.vert.js';


import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';
import { GPUComputationRenderer } from 'three/addons/misc/GPUComputationRenderer.js';



// Set up scene
const scene = new THREE.Scene();

// Set up camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 3000);
camera.position.z = 30;

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
const simulationMatSize = 256;

// multiply by 4 to add RGBA channels
const data = new Float32Array(simulationMatSize * simulationMatSize * 4)

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
let mouseX = 0, mouseY = 0;

function initGGPU() {
  gpuCompute = new GPUComputationRenderer(simulationMatSize, simulationMatSize, renderer);
  const changePosition = gpuCompute.createTexture();
  const changeVelocity = gpuCompute.createTexture();

  positionVariable = gpuCompute.addVariable('texturePosition', fragSimShader, changePosition);
  velocityVariable = gpuCompute.addVariable('textureVelocity', vertSimShader, changeVelocity);
  
  
}



initGGPU();
initEvents();