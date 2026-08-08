# Personal portfolio

A portfolio site built around two independent GPU particle simulations, written with Three.js, GSAP and Vite.

Live: [personalportfoliowebsite-zi3.pages.dev](https://personalportfoliowebsite-zi3.pages.dev/)

## What it does

**A million-particle model.** A GLB is sampled into a million surface points, which are stored in a floating point texture and stepped entirely on the GPU. Nothing is read back to the CPU: positions live in a texture that is ping-ponged between two render targets, and each particle's vertex attribute is only the texel it reads from.

**Five strange attractors.** The cloud holds the ship for ten seconds, then comes apart into Thomas, Lorenz, Rössler, Halvorsen and Dadras in turn, or whichever you pick from the buttons under the tagline. Each attractor is measured offline and normalised in the shader to a common centre, radius and step size, so switching between them never moves the camera and every one drifts at the same rate. Colour follows particle speed through the field.

**Project screenshots drawn as particles.** Each screenshot is a second million-particle system on its own renderer: every particle carries one pixel of the image and holds position with an under-damped spring, so the cursor pushes the picture around and it settles back. Switching projects releases the springs, scatters the image, and hands over the colours while there is nothing legible on screen.

**Framing that follows the DOM.** The canvas is fixed and fullscreen, but the model is framed inside a layout box: `setViewOffset` is run backwards, fitting the frustum to the target element and then widening it out to the viewport. Camera distances are fractions of the distance at which the model exactly fills its box, so the composition holds at any window shape without a single hardcoded z.

**One clock.** Smooth scrolling, tweening and both render passes run inside a single `gsap.ticker` callback, and the simulation advances in 60 Hz-equivalent steps, so it behaves the same on a 60 Hz laptop and a 144 Hz monitor.

**Controls.** Particle size and count are adjustable at the top of the page. The starting count is chosen from the GPU tier; the ceiling is 1,048,576 per system.

## Layout

```
3DViteProject/
  main.js             both renderers, the GLB sampling, the ship simulation, the frame loop
  imageParticles.js   the screenshot simulation
  cameraRig.js        framing the model inside a DOM element
  animation.js        scroll timelines, the loading intro, camera distance
  attractors.js       what the cloud is, and the cycle between shapes
  menu.js             project panels and the screenshot canvas handover
  viewerControls.js   size and count sliders
  glsl/               simulation and draw shaders for both systems
```

## Running it

```
cd 3DViteProject
npm install
npm run dev
```

Then open <http://localhost:5173>. `npm run build` produces the static bundle.

Requires a WebGL2 context with float render targets. On mobile the simulation runs at a lower resolution and the screenshots fall back to plain images.

## Credits

Model: "Radiant Pillar BC1" by 44bit, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), via [Sketchfab](https://skfb.ly/onXry).
Type: [Epilogue](https://www.fontshare.com/fonts/epilogue) by Tyler Finck, Etcetera Type Co.

## Licence

[MIT](LICENSE).

## Contact

[oatesha@gmail.com](mailto:oatesha@gmail.com)
