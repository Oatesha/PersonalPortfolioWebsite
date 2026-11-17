import { frame, lockAttractor, resumeCycle, showPicture, clearPicture, mobile } from './cloud.js';

// shot is the image the cloud forms while a project is selected. It is null for
// this site, which shows the cloud itself.
const PROJECTS = [
  {
    title: 'Minecraftle',
    repo: 'https://github.com/Oatesha/minecraftle',
    shot: '/scenes/minecraftle.webp',
    shotMobile: '/scenes/mobile/minecraftle.webp',
    blurb:
      'Minecraftle is a daily puzzle game where users have to guess the daily Minecraft recipe. Built as a university project, it scored 100% and has had 3,422,788 unique players as of November 2026',
  },
  {
    title: 'Personal Project',
    repo: 'https://github.com/Oatesha/PersonalPortfolioWebsite',
    shot: null,
    shotMobile: null,
    blurb:
      'My personal website showcases my past projects built with Three.js and GSAP. It simulates up to 1.6 million particles on the GPU and uses custom shaders to form them into interactive images',
  },
  {
    title: 'QFIN',
    repo: 'https://github.com/Oatesha/2022-Mean-Reversion-Buy-Hold',
    shot: '/scenes/qfin.webp',
    shotMobile: '/scenes/mobile/qfin.webp',
    blurb:
      'An algorithmic trading project where we investigated different methods to apply mean reversion to trading common S&amp;P 500 stocks. The project also involved co-authoring a comprehensive report documenting the algorithm design process, key design choices, steps to achieve profitability, as well as recommendations for future iterations',
  },
  {
    title: 'Vendetta',
    repo: 'https://github.com/Oatesha/FPSGame',
    shot: '/scenes/vendetta.webp',
    shotMobile: '/scenes/mobile/vendetta.webp',
    blurb:
      "Vendetta is a networked FPS game developed in C# with Unity. It features a lobby system with Unity's relay service for peer-to-peer UDP player connections without the need for port forwarding and the game also utilizes object pooling and custom curve-based procedural animations",
  },
];

// Negative puts the camera inside the cloud.
const BACKDROP_FIT = -0.15;

let selectedProject = 0;
let projectsShown = false;
let section, stage, picks;

export function initProjects() {
  section = document.querySelector('.ProjectSection');
  section.classList.toggle('is-phone', mobile);

  const pick = (project) => `
    <button class="ProjectPick" type="button" aria-pressed="false">
      <span class="ProjectName">${project.title}</span>
    </button>`;
  const detail = (project) => `
    <div class="ProjectDetail">
      <p class="ProjectBlurb">${project.blurb}</p>
      <a class="ProjectRepo" href="${project.repo}" target="_blank" rel="noreferrer">Repository &#8599;</a>
    </div>`;

  section.innerHTML = mobile
    ? `<ul class="ProjectTabs">${PROJECTS.map((project) => `<li data-project>${pick(project)}</li>`).join('')}</ul>
      <div class="ProjectStage" aria-hidden="true"><img class="ProjectShot" alt=""></div>
      ${detail(PROJECTS[0])}`
    : `<div class="ProjectStage" aria-hidden="true"></div>
      <ul class="ProjectCorners">${PROJECTS.map((project) => `<li class="ProjectCorner" data-project>${pick(project)}${detail(project)}</li>`).join('')}</ul>`;

  stage = section.querySelector('.ProjectStage');
  picks = [...section.querySelectorAll('[data-project]')];
  picks.forEach((item, index) => {
    item.querySelector('.ProjectPick').addEventListener('click', () => selectProject(index));
  });

  paintProjects();
}

function paintProjects() {
  const project = PROJECTS[selectedProject];

  stage.classList.toggle('is-model', !project.shot);

  if (mobile) {
    // For this site the previous screenshot stays in place, hidden by is-model.
    if (project.shotMobile) {
      section.querySelector('.ProjectShot').src = project.shotMobile;
    }
    section.querySelector('.ProjectBlurb').innerHTML = project.blurb;
    section.querySelector('.ProjectRepo').href = project.repo;
  }

  picks.forEach((item, index) => {
    item.classList.toggle('is-active', index === selectedProject);
    item.querySelector('.ProjectPick').setAttribute('aria-pressed', String(index === selectedProject));
  });
}

function selectProject(index) {
  if (index !== selectedProject) {
    selectedProject = index;
    paintProjects();
    showProject();
  }
}

export function enterProjects() {
  projectsShown = true;
  showProject();
}

export function leaveProjects() {
  if (projectsShown) {
    projectsShown = false;
    clearPicture();
  }
}

function showProject() {
  const project = PROJECTS[selectedProject];

  // Phones show the screenshot as an image, with the cloud as a backdrop.
  if (mobile && project.shot) {
    frame(section, { fit: BACKDROP_FIT, duration: 0.5 });
    resumeCycle();
    return;
  }

  frame(stage);

  if (project.shot) {
    showPicture(project.shot);
  } else {
    lockAttractor();
  }
}
