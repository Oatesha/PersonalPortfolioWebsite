export const vertexShader = /* glsl */`
uniform float time;
varying vec2 vUv;
varying vec3 vPosition;
uniform sampler2D texturePosition;
float PI = 3.141592653589793238;
attribute vec2 references;

#include <common>

void main() {
	vUv = references;

	vec4 tPos = texture2D(texturePosition, references);
	vec3 pos = tPos.xyz;
	
	vec3 newPos = mat3( modelMatrix ) * position;

	newPos += pos;
	

	vec4 mvPosition = modelViewMatrix * vec4( pos, 1.0);


	gl_PointSize = 30.0 * (1.0 / - mvPosition.z );
	gl_Position = projectionMatrix * mvPosition;
}

`;