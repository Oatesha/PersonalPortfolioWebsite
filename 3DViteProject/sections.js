import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { buildMark } from './marks.js';
import { rig, setRigTarget, showMark, clearMark, lockAttractor, resumeCycle, mobile } from './cloud.js';

gsap.registerPlugin(ScrollTrigger);

// shot is what the cloud becomes while a project is selected, null where the
// cloud itself is the picture. shotMobile is the phone fallback
const PROJECTS = [
  {
    title: "Minecraftle",
    repo: "https://github.com/Oatesha/minecraftle",
    shot: "/scenes/minecraftle.webp",
    shotMobile: "/scenes/mobile/minecraftle.webp",
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
    shot: "/scenes/qfin.webp",
    shotMobile: "/scenes/mobile/qfin.webp",
    blurb:
      "An algorithmic trading project where we investigated different methods to apply mean reversion to trading common S&P 500 stocks. The project also involved co-authoring a comprehensive report documenting the algorithm design process, key design choices, steps to achieve profitability, as well as recommendations for future iterations",
  },
  {
    title: "Vendetta",
    repo: "https://github.com/Oatesha/FPSGame",
    shot: "/scenes/vendetta.webp",
    shotMobile: "/scenes/mobile/vendetta.webp",
    blurb:
      "Vendetta is a networked FPS game developed in C# with Unity. It features a lobby system with Unity's relay service for peer-to-peer UDP player connections without the need for port forwarding and the game also utilizes object pooling and custom curve-based procedural animations",
  },
];

// the project the cloud itself stands in for
const MODEL_PROJECT = PROJECTS.findIndex((project) => project.shot === null);

// mark is rasterised into a particle target it looks best with bold solid shapes
const JOBS = [
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

const ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(text) {
  return text.replace(/[&<>"']/g, (character) => ESCAPES[character]);
}

// building a mark is async, so only the newest pick reaches the cloud
let pickToken = 0;

async function showPicture(src, accent) {
  const token = ++pickToken;
  const mark = await buildMark(src, accent);

  if (mark && token === pickToken) {
    showMark(mark.texture, mark.framing);
  }
}

function dropPicture() {
  pickToken++;
  clearMark();
}

// every project is on screen at once and the stage in the middle holds one of them

let selectedProject = 0;
let picks = [];
let stage = null;
let shot = null;
// the phone layout has one detail panel the selection paints
let blurb = null;
let repo = null;
let projectsRouted = false;

export function initProjects() {
  const section = document.querySelector('.ProjectSection');

  if (!section) {
    return;
  }

  // on a phone the names and picture are stacked vertically
  section.classList.toggle('is-phone', mobile);
  section.innerHTML = mobile ? phoneLayout() : cornerLayout();

  stage = section.querySelector('.ProjectStage');
  shot = section.querySelector('.ProjectShot');
  blurb = mobile ? section.querySelector('.ProjectBlurb') : null;
  repo = mobile ? section.querySelector('.ProjectRepo') : null;
  picks = [...section.querySelectorAll('[data-project]')];
  picks.forEach((item, index) => {
    item.querySelector('.ProjectPick').addEventListener('click', () => selectProject(index));
  });

  paintProjects();
}

// on a desktop the stage is an empty box the rig frames into
function cornerLayout() {
  return `
    <div class="ProjectStage" aria-hidden="true"></div>
    <ul class="ProjectCorners">${PROJECTS.map(corner).join('')}</ul>`;
}

function phoneLayout() {
  return `
    <ul class="ProjectTabs">${PROJECTS.map(tab).join('')}</ul>
    <div class="ProjectStage" aria-hidden="true"><img class="ProjectShot" alt=""></div>
    <div class="ProjectDetail">
      <p class="ProjectBlurb"></p>
      <a class="ProjectRepo Label" target="_blank" rel="noreferrer">Repository &#8599;</a>
    </div>`;
}

function tab(project, index) {
  return `
    <li class="ProjectTab" data-project="${index}">
      <button class="ProjectPick" type="button" aria-pressed="false">
        <span class="ProjectName">${escapeHtml(project.title)}</span>
      </button>
    </li>`;
}

function corner(project, index) {
  return `
    <li class="ProjectCorner" data-project="${index}">
      <button class="ProjectPick" type="button" aria-pressed="false">
        <span class="ProjectName">${escapeHtml(project.title)}</span>
      </button>
      <div class="ProjectDetail">
        <p class="ProjectBlurb">${escapeHtml(project.blurb)}</p>
        <a class="ProjectRepo Label" href="${escapeHtml(project.repo)}" target="_blank" rel="noreferrer">Repository &#8599;</a>
      </div>
    </li>`;
}

function paintProjects() {
  const project = PROJECTS[selectedProject];

  stage.classList.toggle('is-model', selectedProject === MODEL_PROJECT);

  // the cloud project has no screenshot, so the last one stays loaded underneath
  if (shot && project.shotMobile) {
    shot.src = project.shotMobile;
  }

  if (blurb) {
    blurb.textContent = project.blurb;
    repo.href = project.repo;
  }

  picks.forEach((item, index) => {
    const active = index === selectedProject;
    item.classList.toggle('is-active', active);
    item.querySelector('.ProjectPick').setAttribute('aria-pressed', String(active));
  });
}

// how this section frames the cloud. owned here so this module and animation.js
// do not import each other
const FIT_DURATION = 1.0;

// a negative fit puts the camera inside the cloud, leaving it a backdrop
const BACKDROP_FIT = -0.15;

let particleProjectActive = false;

export function isParticleProjectActive() {
  return particleProjectActive;
}

// the cloud comes forward and fills the centre box
export function frameParticleProject() {
  setRigTarget(document.querySelector('.ProjectStage'));
  gsap.to(rig, { fit: 1.0, duration: FIT_DURATION, overwrite: 'auto' });
}

// the cloud drops behind the whole section instead
export function frameProjectBackdrop(duration = FIT_DURATION) {
  setRigTarget(document.querySelector('.ProjectSection'));
  gsap.to(rig, { fit: BACKDROP_FIT, duration, overwrite: 'auto' });
}

// on a phone the cloud only comes forward for the cloud project
function animateParticlesIn() {
  particleProjectActive = true;
  frameParticleProject();
  lockAttractor();
}

function animateParticlesOut() {
  particleProjectActive = false;
  frameProjectBackdrop(0.5);
  resumeCycle();
}

// the picture is the cloud itself, so it only runs while the route is on screen
export function enterProjects() {
  projectsRouted = true;
  showProject();
}

export function leaveProjects() {
  if (!projectsRouted) {
    return;
  }

  projectsRouted = false;
  dropPicture();
}

function selectProject(index) {
  if (index === selectedProject) {
    return;
  }

  selectedProject = index;
  paintProjects();
  showProject();
}

function showProject() {
  if (!projectsRouted) {
    return;
  }

  const isModel = selectedProject === MODEL_PROJECT;

  // on a phone the screenshot is the panel, so the cloud stays behind it
  if (mobile) {
    if (isModel) {
      animateParticlesIn();
    } else {
      animateParticlesOut();
    }
    return;
  }

  if (isModel) {
    // the cloud is the picture, so cancel any build still in flight
    pickToken++;
    lockAttractor();
    return;
  }

  showPicture(PROJECTS[selectedProject].shot);
}

// a dated rail against a pinned cloud, the role crossing the line owns the mark.
// not routed to until the jobs and marks are real

let selectedJob = null;
let workRouted = false;

export function renderWork() {
  const section = document.querySelector('.WorkSection');

  if (!section) {
    return;
  }

  section.innerHTML = `
    <div class="WorkStage" aria-hidden="true"></div>
    <div class="WorkRail">
      <h4 class="WorkHeading Label">Work &middot; scroll</h4>
      <ol class="JobList">${JOBS.map(jobItem).join('')}</ol>
    </div>`;

  section.querySelectorAll('.Job').forEach((item) => {
    const index = Number(item.dataset.job);

    // the rows still have triggers while the route is hidden
    const cross = () => workRouted && selectJob(index);

    item.querySelector('.JobToggle')
      .addEventListener('click', () => selectJob(selectedJob === index ? null : index));

    ScrollTrigger.create({
      trigger: item,
      start: 'top 60%',
      end: 'bottom 60%',
      onEnter: cross,
      onEnterBack: cross,
    });
  });
}

function jobItem(job, index) {
  return `
    <li class="Job" data-job="${index}">
      <button class="JobToggle" type="button" aria-expanded="false" aria-controls="job-detail-${index}">
        <span class="JobCompany">${escapeHtml(job.company)}</span>
        <span class="JobRole">${escapeHtml(job.role)}</span>
        <span class="JobDates">${escapeHtml(job.start)} &ndash; ${escapeHtml(job.end)}</span>
      </button>
      <div class="JobDetail" id="job-detail-${index}" hidden>
        <p>${escapeHtml(job.blurb)}</p>
      </div>
    </li>`;
}

function paintJobs() {
  document.querySelectorAll('.Job').forEach((item) => {
    const isOpen = Number(item.dataset.job) === selectedJob;
    item.classList.toggle('is-open', isOpen);
    item.querySelector('.JobToggle').setAttribute('aria-expanded', String(isOpen));
    item.querySelector('.JobDetail').hidden = !isOpen;
  });
}

// the rows have no layout while the route is hidden, so the triggers wait
export function enterWork() {
  workRouted = true;
  ScrollTrigger.refresh();
}

export function leaveWork() {
  workRouted = false;

  if (selectedJob !== null) {
    selectJob(null);
  }
}

function selectJob(index) {
  if (index === selectedJob) {
    return;
  }

  selectedJob = index;
  paintJobs();

  if (index === null) {
    dropPicture();
    return;
  }

  const job = JOBS[index];
  showPicture(job.mark, job.accent);
}
