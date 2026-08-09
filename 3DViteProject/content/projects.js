// the project panels, in the order they cycle. shot null means the model itself
// is the image, so that panel gets the fullscreen canvas framed into it
export const PROJECTS = [
  {
    title: "Minecraftle",
    repo: "https://github.com/Oatesha/minecraftle",
    shot: "/Minecraftle.png",
    shotMobile: "/MinecraftleMob.png",
    blurb:
      "Minecraftle is a daily puzzle game where users have to guess the daily Minecraft recipe. The project scored 100% and achieved over 1,500,000 unique players as of January 2025",
  },
  {
    title: "Personal Project",
    repo: "https://github.com/Oatesha/PersonalPortfolioWebsite",
    shot: null,
    shotMobile: null,
    blurb:
      "My personal website showcases my past projects built with Three.js and GSAP. It features GPU particle rendering using FBO to animate lots of particles and custom shaders for interactive images",
  },
  {
    title: "QFIN",
    repo: "https://github.com/Oatesha/2022-Mean-Reversion-Buy-Hold",
    shot: "/QFIN.png",
    shotMobile: "/QFINMob.png",
    blurb:
      "An algorithmic trading project where we investigated different methods to apply mean reversion to trading common S&P 500 stocks. The project also involved co-authoring a comprehensive report documenting the algorithm design process, key design choices, steps to achieve profitability, as well as recommendations for future iterations",
  },
  {
    title: "Vendetta",
    repo: "https://github.com/Oatesha/FPSGame",
    shot: "/Vendetta.png",
    shotMobile: "/VendettaMob.png",
    blurb:
      "Vendetta is a networked FPS game developed in C# with Unity. It features a lobby system with Unity's relay service for peer-to-peer UDP player connections without the need for port forwarding and the game also utilizes object pooling and custom curve-based procedural animations",
  },
];

// the one panel whose image is the particle model
export const MODEL_PROJECT = PROJECTS.findIndex((project) => project.shot === null);
