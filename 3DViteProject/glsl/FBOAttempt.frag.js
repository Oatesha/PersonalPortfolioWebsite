export const fragSimShader = /* glsl */`



float circles(vec2 uv, float perimiter) {
	float radius = 0.5;
	float dist = radius - distance(uv, vec2(0.5));
	return smoothstep(0.0, perimiter, dist);

}


void main() {
	float alpha = circles(gl_PointCoord, 0.2);

	gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
	gl_FragColor.a *= alpha;

}
`;