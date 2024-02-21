export const vertexShader = /* glsl */`
uniform float size;
uniform float scale;
uniform float time;
varying float varyingWaveValue;
const float PI2 = 6.28318530718;

#ifdef USE_POINTS_UV

	varying vec2 vUv;
	uniform mat3 uvTransform;
	
#endif

void main() {

	#ifdef USE_POINTS_UV

		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;

	#endif

	#include <begin_vertex>
	
	#include <project_vertex>

	gl_PointSize = size; 

	vec3 wavePosition = vec3(modelMatrix * vec4(position, 1.0));

	float t = time * 1.0;
	wavePosition.y -= t;
	float sinVal = sin(mod(wavePosition.y * 9.0, PI2)) * 0.5 + 0.5;
	varyingWaveValue = sinVal;
	float sizeChange = 1.0 + sinVal * 3.0;
	gl_PointSize = size * sizeChange;



	#ifdef USE_SIZEATTENUATION

		bool isPerspective = isPerspectiveMatrix( projectionMatrix );

		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );

	#endif

	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>

}
`;