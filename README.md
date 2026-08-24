# Personal portfolio

My portfolio site built around a particle simulation, written with Three.js, GSAP and Vite.

Live: [personalportfoliowebsite-zi3.pages.dev](https://personalportfoliowebsite-zi3.pages.dev/)

## What it does

Particle simulation.** Particle positions are ping-ponged between two render targets with the particles previous position at the previous frames render target and it's new position written to the current target. Colour is packed into the alpha channel.

**Five chaos attractors.** The particles cycle through Thomas, Rössler, Halvorsen and Dadras chaos attractors every ten seconds.

**Project screenshots drawn with particles.** A picture is rasterised to an alpha mask, one GPU pass lays a grid over it and maps each particle to a pixels cell resulting in a second target texture the particles can  crossfade into.

## Layout

```
3DViteProject/
  main.js       entry
  cloud.js      renderer, GLB loader, the sim, the camera rig, attractors
  marks.js      picture to particle target
  page.js       routes, nav, theme, particle config sliders
  sections.js   project and job contents
  animation.js
  shaders.js
```

## Running it

```
cd 3DViteProject
npm install
npm run dev
```

Then open <http://localhost:5173>

Requires a WebGL2 context with float render targets. On a phone the simulation runs at a lower resolution and the projects section shows plain screenshots.

## Credits

Model: "Radiant Pillar BC1" by 44bit, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), via [Sketchfab](https://skfb.ly/onXry).
Type: [Epilogue](https://www.fontshare.com/fonts/epilogue) by Tyler Finck, Etcetera Type Co.

## Licence

[MIT](LICENSE).

## Contact

[oatesha@gmail.com](mailto:oatesha@gmail.com)
