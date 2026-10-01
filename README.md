# Personal portfolio

My portfolio site built around a particle simulation, written with Three.js, GSAP and Vite.

Live: [personalportfoliowebsite-zi3.pages.dev](https://personalportfoliowebsite-zi3.pages.dev/)

## What it does

Particle positions live in a float texture that is ping-ponged between two render targets each frame, with colour packed into the alpha channel. The cloud cycles through five chaotic attractors (Thomas, Lorenz, Rössler, Halvorsen and Dadras) every ten seconds.

Project screenshots are drawn with the particles. A picture is rasterised to an alpha mask, one GPU pass gives each particle a cell of a grid over it, and the cloud crossfades onto that target.

## Layout

```
3DViteProject/
  main.js      routes, intro, theme, sliders
  cloud.js     renderer, sim, camera rig, attractors, picture targets
  sections.js  project and work content
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

Type: [Epilogue](https://www.fontshare.com/fonts/epilogue) by Tyler Finck, Etcetera Type Co.

## Licence

[MIT](LICENSE).

## Contact

[oatesha@gmail.com](mailto:oatesha@gmail.com)
