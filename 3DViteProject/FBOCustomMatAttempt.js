import './style.css'

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { vertexShader } from './glsl/main.vertFBO.js';
import { fragmentShader } from './glsl/main.fragFBO.js';
import { simvertFBO } from './glsl/simvertFBO';
import { simfragFBO } from './glsl/simfragFBO';

import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';
import { GPUComputationRenderer } from 'three/addons/misc/GPUComputationRenderer.js';

import SimMaterial from './FBOSimMaterial.js';


// Set up scene
const scene = new THREE.Scene();

// Set up camera
const camera = new THREE.OrthographicCamera(-2, 2, 2, -2, -2, 2);
camera.position.z = 0.5;




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

const spotLight = new THREE.SpotLight(0xffff00, 5);
spotLight.position.set(0, 2, 0);
scene.add(spotLight);

renderer.setClearColor(0xDBE9EE, 1);

const geo = new THREE.TorusKnotGeometry(0.5, 0.2, 128, 16);
const mat = new THREE.MeshToonMaterial();
const mesh = new THREE.Mesh(geo, mat);
scene.add(mesh);


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
let FBO, FBO1, geometry, FBOMat, FBOMesh, particleCount, data, FBODataTexture;
let lastTime = performance.now();
let mouseX = 0, mouseY = 0;



function initRenderTarget() {
  const renderTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    format: THREE.RGBAFormat,
    type: THREE.FloatType,
  });
  return renderTarget;
}

function setupFBO() {

  particleCount = 512;

  // get render target for texture that will be rendered off screen and proper render screen target
  FBO = initRenderTarget();
  FBO1 = initRenderTarget();
  // console.log(FBO);
  // console.log(FBO1);

  // plane to cover entire viewport of camera
  geometry = new THREE.PlaneGeometry(4, 4);

  data = new Float32Array(particleCount * particleCount * 4);
  for (let i = 0; i < particleCount; i++) {
    for (let j = 0; j < particleCount; j++) {
      let dataIndex = (i + j * particleCount) * 4;

      data[dataIndex] = Math.random();
      data[dataIndex + 1] = Math.random();
      data[dataIndex + 2] = Math.random();
      data[dataIndex + 3] = 1.0;

    }
  }

  FBODataTexture = new THREE.DataTexture(data, particleCount, particleCount, THREE.RGBAFormat, THREE.FloatType);
  FBODataTexture.magFilter = THREE.NearestFilter;
  FBODataTexture.minFilter = THREE.NearestFilter;
  FBODataTexture.needsUpdate = true;

  FBOMat = new THREE.ShaderMaterial({
    uniforms: {
      uPositions: { value: FBODataTexture },
      time: { value: 0 },
      resolution: { value: new THREE.Vector4() },
    },
    vertexShader: simvertFBO,
    fragmentShader: simfragFBO,
    
  })
  FBOMesh = new THREE.Mesh(geometry, FBOMat);
  scene.add(FBOMesh);
  
  
}

function initGGPU() {
  
}


function initialiseTexturePos(texture) {

  
}

function initialiseVelocityPos(texture) {

}

renderer.setAnimationLoop((_) => {
  

  controls.update();
  renderer.render(scene, camera);
});

initGGPU();
initEvents();
setupFBO();