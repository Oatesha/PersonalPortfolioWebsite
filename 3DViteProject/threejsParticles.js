
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import {TextGeometry} from 'three/addons/geometries/TextGeometry.js' 
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';
import { vertexShader } from './glsl/main.vertFBO.js';
import { fragmentShader } from './glsl/main.fragFBO.js';
import { simvertFBO } from './glsl/simvertFBO.js';
import { simfragFBO } from './glsl/simfragFBO.js';





// // Create an instance of the Stats object
// const stats = new Stats();

// // Add the Stats object to the HTML document
// document.body.appendChild(stats.dom);

const root = document.documentElement;
root.dataset.theme = 'dark';

let renderTargetB, renderTargetA, h, simMaterial, renderMaterial, fbo;

let scene = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(50, window.innerWidth/window.innerHeight, 0.001, 30000);

const renderer = new THREE.WebGLRenderer();
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild( renderer.domElement );


// renderer.setClearColor(0x0A0A09);
renderer.setClearColor(0x000000, 0);


const pointer = new THREE.Vector2();
const raycaster = new THREE.Raycaster();

const dummyGeom = new THREE.PlaneGeometry(512, 512);
const dummyMat = new THREE.MeshBasicMaterial();
const dummyObject = new THREE.Mesh(dummyGeom, dummyMat);
dummyObject.position.set (0, 0, 0);


function initEvents() {
  window.addEventListener( 'resize', onWindowResize, false );

  function onWindowResize(){

    camera.aspect = window.innerWidth / window.innerHeight;
    // camera.left = ( (window.innerWidth)) / -150;
    // camera.right = ((window.innerWidth)) / 150;
    camera.updateProjectionMatrix();

    renderer.setSize( window.innerWidth, window.innerHeight );

  }

  document.addEventListener( 'pointermove', onPointerMove );

  function onPointerMove( event ) {

    pointer.x = ( event.clientX / window.innerWidth ) * 2 - 1;
    pointer.y = - ( event.clientY / window.innerHeight ) * 2 + 1;


  }

  initFBO();
  
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

      let theta = Math.random() * Math.PI * 4.;
      let r = -20. + 5.* Math.random();
      initPos[index] = r * Math.cos(theta);
      initPos[index + 1] = r * Math.sin(theta);
      initPos[index + 2] = (Math.random() ),
      initPos[index + 3] = 1.0;
    }
  }


 // Set up a geometry to sample positions from
  let tetrageometry = new THREE.TorusKnotGeometry(5);
  let mesh = new THREE.Mesh(tetrageometry);

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

  // let dataTex = new THREE.DataTexture(particleInitPosArray, w, h, THREE.RGBAFormat, THREE.FloatType);

  let dataTex = new THREE.DataTexture(initialPositionsArray, w, h, THREE.RGBAFormat, THREE.FloatType);
  // let dataTex = new THREE.DataTexture(texture.image, w, h, THREE.RGBAFormat, THREE.FloatType);

  dataTex.minFilter = THREE.NearestFilter;
  dataTex.magFilter = THREE.NearestFilter;
  dataTex.needsUpdate = true;

  // init simulation mat with above created data texture

  simMaterial = new THREE.ShaderMaterial({
    uniforms: { posTex: { value: dataTex },
    originalPosTex: { value: dataTex}, 
    mouse: { value : new THREE.Vector2(10,10)},},
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
    // colorTexture: {value: particleInitColorArray}, 
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

    let points = new THREE.Points(geometry, renderMaterial);
    scene.add(points);
    renderMaterial.uniforms.posTex.value = dataTex;
}


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
  renderMaterial.uniforms.u_time.value = performance.now() * 0.0001;

  renderer.render(scene, camera);
  
  raycaster.setFromCamera(pointer, camera);

  let intersects = raycaster.intersectObject(dummyObject);
  if (intersects.length > 0) {
    let {x,y} = intersects[0].point;
    simMaterial.uniforms.mouse.value = new THREE.Vector2(x,y);
  }


  // Request the next frame
  
  requestAnimationFrame(render);

}

// let particleInitPosArray, particleInitColorArray;


initEvents();
render()





// function getImage(img) {
//   const canvas = document.createElement('canvas');
//   canvas.width = img.width;
//   canvas.height = img.height;
//   console.log(canvas.width + " " + canvas.height);
//   const ctx = canvas.getContext('2d');

//   ctx.drawImage(img, 0, 0);

//   const imageData = ctx.getImageData(0, 0, img.width, img.height);
//   const data = imageData.data;

//   const length = img.width * img.height;
//   const pointData = new Float32Array(length * 4); // Change to length * 4
//   const colourData = new Float32Array(length * 4); // Change to length * 4

//   for (let i = 0, j = 0; i < length; i++, j += 4) {
//     const x = (i % img.width) / img.width - 0.5;
//     const y = (i / img.width) / img.height - 0.5;
//     // const grayscale = data[i * 4] * 0.299 + data[i * 4 + 1] * 0.587 + data[i * 4 + 2] * 0.114;

//     pointData[j] = x * img.width;
//     pointData[j + 1] = y * img.height;
//     pointData[j + 2] = 1.0
//     pointData[j + 3] = 1.0; // Set the alpha value to 1.0
    
//     colourData[j ] = data[i * 4]; // Red
//     colourData[j + 1] = data[i * 4 + 1]; // Green
//     colourData[j + 2] = data[i * 4 + 2]; // Blue
//     colourData[j + 3] = data[i * 4 + 3]; // Alpha
//   }

//   return [pointData, colourData];
// }