import './style.css'

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { vertexShader } from './glsl/main.vert.js';
import { fragmentShader } from './glsl/main.frag.js';
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';

// Set up scene
const scene = new THREE.Scene();

// Set up camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 100;

// Set up renderer
const renderer = new THREE.WebGLRenderer({
  canvas: document.querySelector('#Background'),
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
const controls = new OrbitControls(camera, renderer.domElement);

// Create lights
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(1, 1, 1).normalize();
scene.add(directionalLight);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

renderer.setClearColor(0xffffff, 1);

let objectToSample = new THREE.TorusKnotGeometry(10, 1, 2048, 64, 4);
let meshToSample = new THREE.Mesh(objectToSample, new THREE.MeshBasicMaterial({color: 0x000000}));


const sampler = new MeshSurfaceSampler(meshToSample).build(); 
const sampledGeo = new THREE.BufferGeometry().setFromPoints(new Array(10000).fill().map(_ => {
  let point = new THREE.Vector3();
  sampler.sample(point);
  return point;
}));

let elapsedTime = {
  time: {value: 1}
}

// ---------------------------------------------------------------
initEvents();
setParticleGrid();


function initEvents() {
  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);

  });

  // document.addEventListener( 'mousemove', (ev) => onMouseMove(ev));

  // function onMouseMove(ev) { 

  //   mouse.x = (ev.clientX / window.innerWidth ) * 2 - 1;
  //   mouse.y = - (ev.clientY / window.innerHeight ) * 2 + 1;

  //   console.log("mouse x :" + mouse.x + " mouse y :" + mouse.y);
  //   raycaster.setFromCamera(mouse, camera);
  //   const intersects = raycaster.intersectObject(instancedMesh);
  //   if (intersects.length > 0) {
  //     // console.log("Intersecting");
  //   }

  // }

}



// ---------------------------------------------------------------
function setParticleGrid() {
  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      size: {value: 3},
      time: elapsedTime.time,
    },
    transparent: true,
    depthWrite: false,
  });
  // const material = new THREE.PointsMaterial({color: 0xffffff})

  const mesh = new THREE.Points(sampledGeo, material);

  scene.add(mesh);
}



let clock = new THREE.Clock();

renderer.setAnimationLoop((_) => {
  let t = clock.getElapsedTime();
  elapsedTime.time.value = t;

  controls.update();
  renderer.render(scene, camera);
});


