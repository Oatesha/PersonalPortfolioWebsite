
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import {TextGeometry} from 'three/addons/geometries/TextGeometry.js' 
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


const camArm = new THREE.Group();


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

    

    raycaster.setFromCamera(pointer, camera);

    let intersects = raycaster.intersectObject(dummyObject);
    if (intersects.length > 0) {
      let {x,y} = intersects[0].point;
      simMaterial.uniforms.mouse.value = new THREE.Vector2(x,y);
    }

  }

  initFBO();
  
}  


function initFBO() {
  // verify browser can support float textures
  if (!renderer.capabilities.floatVertexTextures) {
    alert(' * Browser does not support float vertex and fragment shaders');
  }


  let w = h = 512;

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
      initPos[index + 3] = 0.0;
    }
  }


  let dataTex = new THREE.DataTexture(initPos, w, h, THREE.RGBAFormat, THREE.FloatType);
  dataTex.minFilter = THREE.NearestFilter;
  dataTex.magFilter = THREE.NearestFilter;
  dataTex.needsUpdate = true;

  // init simulation mat with above created data texture
  simMaterial = new THREE.ShaderMaterial({
    uniforms: { posTex: { value: dataTex }, 
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
    time: {value: 1.0}},
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
    camArm.add(points);
    scene.add(camArm);
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
  renderMaterial.uniforms.time.value = performance.now() * 0.0001;

  renderer.render(scene, camera);
  // Request the next frame
  requestAnimationFrame(render);
  // camArm.rotation.x += 0.0025;
  // camArm.rotation.y += 0.0025;

}


initEvents();

render()