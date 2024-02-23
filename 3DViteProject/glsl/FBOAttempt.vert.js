export const vertSimShader = /* glsl */`
uniform float time;
varying vec2 vUv;
varying vec3 vPosition;
uniform sampler2D texture1;
float PI = 3.141592653589793238;
attribute vec2 reference;

void main() {
	vUv = uv;
	vec4 mvPosition = modelViewMatrix * vec4( position, 1.0);
	gl_PointSize = 30.0 * (1.0 / - mvPosition.z );
	gl_Position = projectionMatrix * mvPosition;
}

`;