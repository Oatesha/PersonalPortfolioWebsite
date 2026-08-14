// shot null means the particle model itself is that panel's image
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

export const MODEL_PROJECT = PROJECTS.findIndex((project) => project.shot === null);

// mark is rasterised into a particle target so it wants bold solid shapes and no
// hairlines. accent paints those particles when the mark is a flat silhouette
export const JOBS = [
  {
    company: "Placeholder One",
    role: "Placeholder role",
    start: "2025",
    end: "Present",
    mark: "/marks/placeholder-one.svg",
    accent: "#C2551A",
    blurb:
      "Placeholder. Replace with what the job actually was, what you owned, and the number that makes it worth reading.",
  },
  {
    company: "Placeholder Two",
    role: "Placeholder role",
    start: "2024",
    end: "2025",
    mark: "/marks/placeholder-two.svg",
    accent: "#495A78",
    blurb:
      "Placeholder. Replace with what the job actually was, what you owned, and the number that makes it worth reading.",
  },
  {
    company: "Placeholder Three",
    role: "Placeholder role",
    start: "2023",
    end: "2024",
    mark: "/marks/placeholder-three.svg",
    accent: "#8C5A44",
    blurb:
      "Placeholder. Replace with what the job actually was, what you owned, and the number that makes it worth reading.",
  },
];
