import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { frame, lockAttractor, resumeCycle, showPicture, clearPicture, mobile } from './cloud.js';

// shot is what the cloud becomes while a project is selected, null where the
// cloud itself is the picture
const PROJECTS = [
  {
    title: 'Minecraftle',
    repo: 'https://github.com/Oatesha/minecraftle',
    shot: '/scenes/minecraftle.webp',
    shotMobile: '/scenes/mobile/minecraftle.webp',
    blurb:
      'Minecraftle is a daily puzzle game where users have to guess the daily Minecraft recipe. The project scored 100% and achieved over 1,500,000 unique players as of January 2025',
  },
  {
    title: 'Personal Project',
    repo: 'https://github.com/Oatesha/PersonalPortfolioWebsite',
    shot: null,
    shotMobile: null,
    blurb:
      'My personal website showcases my past projects built with Three.js and GSAP. It features GPU particle rendering using FBO to animate lots of particles and custom shaders for interactive images',
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

// marks read best as bold solid shapes
const JOBS = [
  {
    company: 'Placeholder One',
    role: 'Placeholder role',
    dates: '2025 &ndash; Present',
    mark: '/marks/placeholder-one.svg',
    accent: '#C2551A',
    blurb: 'Placeholder.',
  },
  {
    company: 'Placeholder Two',
    role: 'Placeholder role',
    dates: '2024 &ndash; 2025',
    mark: '/marks/placeholder-two.svg',
    accent: '#495A78',
    blurb: 'Placeholder.',
  },
  {
    company: 'Placeholder Three',
    role: 'Placeholder role',
    dates: '2023 &ndash; 2024',
    mark: '/marks/placeholder-three.svg',
    accent: '#8C5A44',
    blurb: 'Placeholder.',
  },
];

// negative puts the camera inside the cloud
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
    // the cloud project keeps the last screenshot, hidden
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

  // on a phone the screenshot is the picture, so the cloud goes behind it
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

let selectedJob = null;
let workShown = false;

export function initWork() {
  const work = document.querySelector('.WorkSection');

  work.innerHTML = `
    <div class="WorkStage" aria-hidden="true"></div>
    <div class="WorkRail">
      <h2 class="WorkHeading">Work &middot; scroll</h2>
      <ol class="JobList">${JOBS.map((job, index) => `
        <li class="Job">
          <button class="JobToggle" type="button" aria-expanded="false" aria-controls="job-detail-${index}">
            <span class="JobCompany">${job.company}</span>
            <span class="JobRole">${job.role}</span>
            <span class="JobDates">${job.dates}</span>
          </button>
          <div class="JobDetail" id="job-detail-${index}" hidden><p>${job.blurb}</p></div>
        </li>`).join('')}
      </ol>
    </div>`;

  work.querySelectorAll('.Job').forEach((item, index) => {
    item.querySelector('.JobToggle').addEventListener('click', () => selectJob(selectedJob === index ? null : index));

    // the triggers still fire while the route is hidden
    const cross = () => workShown && selectJob(index);
    ScrollTrigger.create({ trigger: item, start: 'top 60%', end: 'bottom 60%', onEnter: cross, onEnterBack: cross });
  });
}

export function enterWork() {
  workShown = true;
  frame(document.querySelector('.WorkStage'));
  // the rows had no layout while the route was hidden
  ScrollTrigger.refresh();
}

export function leaveWork() {
  workShown = false;
  selectJob(null);
}

function selectJob(index) {
  if (index === selectedJob) {
    return;
  }
  selectedJob = index;

  document.querySelectorAll('.Job').forEach((item, i) => {
    item.classList.toggle('is-open', i === index);
    item.querySelector('.JobToggle').setAttribute('aria-expanded', String(i === index));
    item.querySelector('.JobDetail').hidden = i !== index;
  });

  if (index === null) {
    clearPicture();
  } else {
    showPicture(JOBS[index].mark, JOBS[index].accent);
  }
}
