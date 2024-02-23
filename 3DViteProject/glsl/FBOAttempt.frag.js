export const fragSimShader = /* glsl */`
uniform float time;
uniform float delta;
uniform sampler2D texturePosition;

void main()	{

	vec2 uv = gl_FragCoord.xy / resolution.xy;
	vec3 position = texture2D( texturePosition, uv ).xyz;

	gl_FragColor = vec4( position + vec3(0.001), 1.0);

}
`;