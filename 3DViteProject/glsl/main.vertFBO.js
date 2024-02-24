export const vertexShader = /* glsl */`

//float texture containing the positions of each particle
uniform sampler2D uPositions;

varying vec2 vUv;

//size
uniform float pointSize;

void main() {
    vUv = uv;
    //the mesh is a nomrliazed square so the uvs = the xy positions of the vertices
    vec4 pos = texture2D( uPositions, uv );

    //pos now contains the position of a point in space taht can be transformed
    gl_Position = projectionMatrix * modelViewMatrix * vec4( pos.xyz, 1.0 );

    gl_PointSize = 3.0;
}



`;