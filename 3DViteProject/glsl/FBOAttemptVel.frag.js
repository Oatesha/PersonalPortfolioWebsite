export const fragVelSimShader = /* glsl */`

uniform float time;
uniform float delta; // about 0.016


void main() {


    vec3 selfPosition = texture2D( texturePosition, references ).xyz;
    vec3 selfVelocity = texture2D( textureVelocity, references ).xyz;
    vec3 velocity = selfVelocity;

    if ( length( velocity ) > 9.0 ) {
        velocity = normalize( velocity ) * 9.0;
    }
    gl_FragColor = vec4( velocity, 1.0 );
}
`;