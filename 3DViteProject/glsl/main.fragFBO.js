export const fragmentShader = /* glsl */`


uniform float u_time; // Uniform variable to pass time

void main() {
    // Calculate a value between 0 and 1 based on the time
    float t = sin(u_time * 0.5) * 0.5 + 0.5;

    // Define the base color
    vec3 baseColor = vec3(0.6, 0.2, 0.8); // Purple-ish color



    gl_FragColor = vec4(1.0);
}


`;