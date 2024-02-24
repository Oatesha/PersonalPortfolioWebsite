import * as THREE from 'three';
import { simvertFBO } from './glsl/simvertFBO';
import { simfragFBO } from './glsl/simfragFBO';

const initialParticlePositions = (width, height) => {

  // needs to be size of the pixels in our texture (width * height) multiplied by 4 for RGBA values
  const arraySize = width * height * 4;

  const posArray = new Float32Array(arraySize);

  for ( let i = 0; i < arraySize; i += 4) {
    // const distance = Math.sqrt(Math.random()) * 2.0;
    // const theta = THREE.MathUtils.randFloatSpread(360); 
    // const phi = THREE.MathUtils.randFloatSpread(360); 

    // data[stride] =  distance * Math.sin(theta) * Math.cos(phi)
    // data[stride + 1] =  distance * Math.sin(theta) * Math.sin(phi);
    // data[stride + 2] =  distance * Math.cos(theta);
    // data[stride + 3] =  1.0; // this value will not have any impact
    posArray[i] = Math.random() * 10; 
    posArray[i+1] = Math.random() * 10;
    posArray[i+2] = Math.random() * 10;
    posArray[i+3] = 1.0;
  }

  return posArray;
}

export default class FBOMaterial extends THREE.ShaderMaterial {
  // constructor(particleCount) {
  //   const posTexture = new THREE.DataTexture(
  //     initialParticlePositions(particleCount, particleCount),
  //     particleCount,
  //     particleCount,
  //     THREE.RGBAFormat,
  //     THREE.FloatType,
  //   );
  //   posTexture.needsUpdate = true;

  //   const simShaderUniforms = {
  //     positions: { value: texturePositions },
  //     uFreq: { value: 1.0 },
  //     uTime: { value: 0.0 },
  //   };

  //   super({
  //     uniforms: simShaderUniforms,
  //     vertexShader: simvertFBO,
  //     fragmentShader: simfragFBO,
  //   })

  // }
}
