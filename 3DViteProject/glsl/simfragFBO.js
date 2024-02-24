export const simfragFBO = /* glsl */`

uniform sampler2D uPositions;
varying vec2 vUv;
void main() {

    //basic simulation: displays the particles in place.
    vec4 pos = texture2D( uPositions, vUv );
    /*
        we can move the particle here 
    */
    gl_FragColor = pos;
}
`;