import './style.css'

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { vertexShader } from './glsl/main.vertFBO.js';
import { fragmentShader } from './glsl/main.fragFBO.js';
import { simvertFBO } from './glsl/simvertFBO';
import { simfragFBO } from './glsl/simfragFBO.js';

import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';



let gl, renderTargetB, h

// specify where to render scene
let renderHTMLTarget = document.querySelector('#Background'),
    elemW = renderHTMLTarget.clientWidth,
    elemH = renderHTMLTarget.clientHeight


let scene = new THREE.Scene();
let camera = new THREE.PerspectiveCamera(75, elemW/elemH, 0.001, 3000);


const renderer = new THREE.WebGLRenderer({
  canvas: document.querySelector('#Background'),
});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
const controls = new OrbitControls(camera, renderer.domElement);


camera.position.set(0, 0, 75);



// verify browser can support float textures
gl = renderer.getContext();
if (!renderer.capabilities.floatVertexTextures) {
  alert(' * Browser does not support float vertex and fragment shaders');
}

// set initial positions of width and height of data texture which when multiplied gives particle count
let w = h = 512;

// initialise positions of particles in data texture
let initPos = new Float32Array(w * h * 4);
for (let i = 0; i < w; i++) {
  for (let j = 0; j < w; j++) {
    let index = (i + j * w) * 4;

    let theta = Math.random() * Math.PI * 4.;
    let r = 0.5 + 0.5 * Math.random();

    initPos[index] = r * Math.cos(theta);
    initPos[index + 1] = r * Math.sin(theta);
    initPos[index + 2] = (Math.random()),
    initPos[index + 3] = 1.0;

  }
}

// feed those positions into a data texture
let dataTex = new THREE.DataTexture(initPos, w, h, THREE.RGBAFormat, THREE.FloatType);
dataTex.minFilter = THREE.NearestFilter;
dataTex.magFilter = THREE.NearestFilter;
dataTex.needsUpdate = true;

let simMaterial = new THREE.ShaderMaterial({
  uniforms: { posTex: { value: dataTex }, },
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

// create a scene where we'll render the positional attributes
var fbo = new FBO(w, simMaterial);

// create render targets a + b to which the simulation will be rendered
var renderTargetA = new THREE.WebGLRenderTarget(w, h, {
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


var renderMaterial = new THREE.ShaderMaterial({
  uniforms: { posTex: { value: null }, },
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

let points = new THREE.Points(geometry, renderMaterial);
scene.add(points);

renderMaterial.uniforms.posTex.value = dataTex;

function render() {

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
  // Request the next frame
  requestAnimationFrame(render);
  controls.update();
}

render()