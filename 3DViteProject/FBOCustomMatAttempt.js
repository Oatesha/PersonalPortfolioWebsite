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
import FBOMaterial from './FBOSimMaterial.js';


// Set up scene
const scene = new THREE.Scene();

// Set up camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 3000);
camera.position.z = 50;
//4 create a target texture
var options = {
  minFilter: THREE.NearestFilter,//important as we want to sample square pixels
  magFilter: THREE.NearestFilter,//
  format: THREE.RGBFormat,//could be RGBAFormat 
  type:THREE.FloatType//important as we need precise coordinates (not ints)
};

const rtt = new THREE.WebGLRenderTarget( window.innerWidth, window.innerHeight, options);



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
let FBO, FBO1, FBOscene, FBOcamera, geometry, renderMat, simMat, FBOMesh, textureWidth, data, FBODataTexture, vertices, particles;
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

  textureWidth = 512;

  // get render target for texture that will be rendered off screen and proper render screen target
  FBO = initRenderTarget();
  FBO1 = initRenderTarget();
  FBOscene = new THREE.Scene();
  FBOcamera = new THREE.OrthographicCamera(-1, 1 ,1 ,-1, -1 ,1);
  // console.log(FBO);
  // console.log(FBO1);

  data = new Float32Array(textureWidth * textureWidth * 4);
  for (let i = 0; i < textureWidth; i++) {
    for (let j = 0; j < textureWidth; j++) {
      let dataIndex = (i + j * textureWidth) * 4;
      let theta = Math.random() * Math.PI * 2;
      let r = 0.5 + 0.5 * Math.random()

      data[dataIndex] = r * Math.cos(theta);
      data[dataIndex + 1] = r * Math.sin(theta);
      data[dataIndex + 2] = Math.random();
      data[dataIndex + 3] = 1.0;

    }
  }

  FBODataTexture = new THREE.DataTexture(data, textureWidth, textureWidth, THREE.RGBAFormat, THREE.FloatType);
  FBODataTexture.magFilter = THREE.NearestFilter;
  FBODataTexture.minFilter = THREE.NearestFilter;
  FBODataTexture.needsUpdate = true;

  console.log(FBODataTexture);

  simMat = new THREE.ShaderMaterial({
    uniforms: {
      uPositions: { value: FBODataTexture },
      time: { value: 0 },
      
    },
    vertexShader: simvertFBO,
    fragmentShader: simfragFBO,
  });


  renderMat = new THREE.ShaderMaterial({
    extensions: {
      derivatives: "#extension GL_OES_standard_derivatives : enable"
    },
    side: THREE.DoubleSide,
    uniforms: {
      uPositions: { value: null },
      time: { value: 0 },
      resolution: { value: new THREE.Vector4() },
    },
    vertexShader: vertexShader,
    fragmentShader: fragmentShader,
  });

  
  let geom = new THREE.BufferGeometry();
  geom.setAttribute( 'position', new THREE.BufferAttribute( new Float32Array([   -2,-2,0, 2,-2,0, 2,2,0, -2,-2, 0, 2, 2, 0, -2,2,0 ]), 3 ) );
  geom.setAttribute( 'uv', new THREE.BufferAttribute( new Float32Array([   0,1, 1,1, 1,0,     0,1, 1,0, 0,0 ]), 2 ) );
  FBOscene.add(new THREE.Mesh(geom, simMat));


let count = textureWidth **2;
geometry = new THREE.BufferGeometry();
let tempPositions = new Float32Array(count * 3);
let tempUV = new Float32Array(count * 2);
for (let i = 0; i < textureWidth; i++) {
  for (let j = 0; j < textureWidth; j++) {
    let index = (i + j * textureWidth);
    tempPositions[index * 3 + 0] = Math.random();
    tempPositions[index * 3 + 1] = Math.random();
    tempPositions[index * 3 + 2] = Math.random();
    tempUV[index * 2 + 0] = i / (textureWidth);
    tempUV[index * 2 + 1] = j / (textureWidth);
  }
}
geometry.setAttribute('position', new THREE.BufferAttribute(tempPositions, 3));
geometry.setAttribute('uv', new THREE.BufferAttribute(tempUV, 2));

renderMat.uniforms.uPositions.value = FBODataTexture;

particles = new THREE.Points(geometry, renderMat);
scene.add(particles);

  
}




function initialiseVertices() {
  vertices = new Float32Array( (textureWidth * textureWidth) * 3 );
  for ( var i = 0; i < (textureWidth * textureWidth); i++ ) {

      var i3 = i * 3;
      vertices[ i3 ] = ( i % textureWidth ) / textureWidth ;
      vertices[ i3 + 1 ] = ( i / textureWidth ) / textureWidth;
  }
}

let clock = new THREE.Clock();
renderer.setAnimationLoop((_) => {
  

  controls.update();
  simMat.uniforms.time.value = clock.getElapsedTime();
  particles.material.uniforms.time.value = clock.getElapsedTime();
  // simMat.uniforms.uPositions.value = FBO1.texture;
  // renderMat.uniforms.uPositions.value = FBO.texture
  renderer.setRenderTarget(rtt);
  renderer.render(FBOscene, FBOcamera);
  particles.material.uniforms.uPositions.value = rtt.texture;

  renderer.setRenderTarget(null);
  renderer.render(scene, camera);

  
  
});
initEvents();
setupFBO();