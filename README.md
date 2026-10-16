# Personal portfolio

My portfolio site, built around a GPU particle simulation of up to 1.6 million particles. Written in plain JavaScript with Three.js, GSAP and Vite, with the simulation in GLSL.

**Live:** [personalportfoliowebsite-zi3.pages.dev](https://personalportfoliowebsite-zi3.pages.dev/)

## How it works

### Simulation on the GPU

Each particle is one texel of a 1280×1280 float texture: position in RGB, colour packed into alpha as `0xRRGGBB`. Every frame, a full-screen fragment shader reads the positions from one render target and writes the next step into another, then the two swap. The CPU never touches particle data after startup, so there is no per-frame upload. The point shader reads its position straight from the texture.

### Attractors

The cloud cycles through five chaotic attractors: Thomas, Lorenz, Rössler, Halvorsen and Dadras. Their natural sizes and speeds differ by orders of magnitude. I integrated each one offline to measure its centre, 99th-percentile radius and a matching timestep. The shader steps each particle in the attractor's own coordinates, then maps the result back to a shared world radius, so all five fill the same space at a similar pace. Switching between attractors adds a short scatter burst, timed to hide the change.

### Pictures from particles

Project screenshots are drawn with the particles themselves:

1. The image is rasterised to a 1024×1024 canvas, and its opaque bounding box is measured.
2. One shader pass gives each particle a cell in a grid over the image, with about one cell per particle. Particles whose cell is transparent rejection-sample the image instead.
3. The result is a target position texture. The simulation crossfades from its current target to the new one using two target slots, plus a third texture so the next picture can be built while a crossfade runs.

### Framing

The canvas is fixed to the viewport, but the cloud is framed to fit a DOM element on each page. The camera's `setViewOffset` is used in reverse: the full view matches the element's rectangle, and the part rendered is whatever of it is in the viewport. This keeps the cloud aligned with the layout while the page scrolls.

### Scaling to the device

[detect-gpu](https://github.com/pmndrs/detect-gpu) sets the default particle count, and sliders let visitors change it and the point size. Phones use a 256×256 simulation and show plain screenshots on the projects page. Browsers without WebGL2 float render targets get the page without the cloud.

## Layout

```
index.html
main.js      routing, intro animation, theme, viewer controls
cloud.js     renderer, simulation, camera framing, attractor cycle, picture targets
sections.js  project section content
shaders.js   GLSL for the simulation, points and picture targets
style.css
public/      fonts, screenshots, Cloudflare Pages redirects
```

## Running locally

Requires Node 22 (see `.nvmrc`).

```
npm install
npm run dev
```

Then open <http://localhost:5173>. `npm run build` writes a static site to `dist/`, which is deployed on Cloudflare Pages.

## Credits

Typeface: [Epilogue](https://www.fontshare.com/fonts/epilogue) by Tyler Finck, Etcetera Type Co.
Hash function: [Hash without Sine](https://www.shadertoy.com/view/4djSRW) by Dave Hoskins.

## Licence

[MIT](LICENSE)
