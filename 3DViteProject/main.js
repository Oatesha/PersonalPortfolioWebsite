import './style.css'

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';



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

const textureFontSize = 100;
const fontScaleFactor = 0.15;

// Settings
const fontName = 'Verdana';

// String to show
let string = 'Example Harrison Oates \nAbout \nProjects';
let dummy, particleGeometry, particleMaterial, instancedMesh
let textureCoordinates;
const raycaster = new THREE.Raycaster();


const mouse = new THREE.Vector2(-200, 200);


let stringBox = {
  wTexture: 0,
  wScene: 0,
  hTexture: 0,
  hScene: 0
};
// Create canvas to sample the text
const textCanvas = document.createElement('canvas');
const textCtx = textCanvas.getContext('2d');
document.body.appendChild(textCanvas);
// Instanced geometry and material
particleGeometry = new THREE.SphereGeometry(.1);
particleMaterial = new THREE.MeshBasicMaterial({color: 0xffffff});

dummy = new THREE.Object3D();



// ---------------------------------------------------------------
refreshText();
initEvents();


function initEvents() {
  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  document.addEventListener( 'mousemove', (ev) => onMouseMove(ev));

  function onMouseMove(ev) { 

    mouse.x = (ev.clientX / window.innerWidth ) * 2 - 1;
    mouse.y = - (ev.clientY / window.innerHeight ) * 2 + 1;

    console.log("mouse x :" + mouse.x + " mouse y :" + mouse.y);
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(instancedMesh);
    if (intersects.length > 0) {
      console.log("Intersecting");
    }

  }

}

function refreshText() {
  sampleCoordinates();
  textureCoordinates = textureCoordinates.map((c) => {
    return { x: c.x * fontScaleFactor, y: c.y * fontScaleFactor };
  });
  const maxX = textureCoordinates.map((v) => v.x).sort((a, b) => b - a)[0];
  const maxY = textureCoordinates.map((v) => v.y).sort((a, b) => b - a)[0];
  stringBox.wScene = maxX;
  stringBox.hScene = maxY;

  createInstancedMesh();
  updateParticlesMatrices();
}
// ---------------------------------------------------------------

function sampleCoordinates() {
  // Parse text
  const lines = string.split(`\n`);
  const linesMaxLength = [...lines].sort((a, b) => b.length - a.length)[0]
    .length;
  stringBox.wTexture = textureFontSize * 0.7 * linesMaxLength;
  stringBox.hTexture = lines.length * textureFontSize;

  // Draw text
  const linesNumber = lines.length;
  textCanvas.width = stringBox.wTexture;
  textCanvas.height = stringBox.hTexture;
  textCtx.font = "100 " + textureFontSize + "px " + fontName;
  textCtx.fillStyle = "#2a9d8f";
  textCtx.clearRect(0, 0, textCanvas.width, textCanvas.height);
  for (let i = 0; i < linesNumber; i++) {
    textCtx.fillText(
      lines[i],
      0,
      ((i + 0.8) * stringBox.hTexture) / linesNumber
    );
  }

  // Sample coordinates
  textureCoordinates = [];
  if (stringBox.wTexture > 0) {
    const imageData = textCtx.getImageData(
      0,
      0,
      textCanvas.width,
      textCanvas.height
    );
    for (let i = 0; i < textCanvas.height; i++) {
      for (let j = 0; j < textCanvas.width; j++) {
        if (imageData.data[(j + i * textCanvas.width) * 4] > 0) {
          textureCoordinates.push({
            x: j,
            y: i
          });
        }
      }
    }
  }
}

// ---------------------------------------------------------------
// Handle points


function createInstancedMesh() {
  instancedMesh = new THREE.InstancedMesh(particleGeometry, particleMaterial, textureCoordinates.length);
  scene.add(instancedMesh);

  // centralize it in the same way as before
  instancedMesh.position.x = -.5 * stringBox.wScene;
  instancedMesh.position.y = -.5 * stringBox.hScene;
}

function updateParticlesMatrices() {
  let idx = 0;
  textureCoordinates.forEach(p => {

      // we apply samples coordinates like before + some random rotation
      dummy.rotation.set(2 * Math.random(), 2 * Math.random(), 2 * Math.random());
      dummy.position.set(p.x, stringBox.hScene - p.y, Math.random());

      dummy.updateMatrix();
      instancedMesh.setMatrixAt(idx, dummy.matrix);

      idx ++;
  })
  instancedMesh.instanceMatrix.needsUpdate = true;
}

// Animation function
function animate() {
    requestAnimationFrame(animate);

    controls.update();
    renderer.render(scene, camera);
}


// Start animation
animate();
