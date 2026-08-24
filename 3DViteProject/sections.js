import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { PROJECTS, MODEL_PROJECT, JOBS } from './content.js';
import { buildMark } from './markTargets.js';
import { showMark, clearMark, lockAttractor } from './attractors.js';
import { animateParticlesIn, animateParticlesOut } from './animation.js';
import { mobile } from './main.js';

gsap.registerPlugin(ScrollTrigger);

// the two routed sections. both hold one selection and hand the cloud the
// picture that goes with it

const ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
};

function escapeHtml(text) {
  return text.replace(/[&<>"]/g, (character) => ESCAPES[character]);
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

// every project sits in a corner at once. the centre stage holds one of them

let selectedProject = 0;
let corners = [];
let stage = null;
let shot = null;
// the corners have no cloud to hand a picture to until the route is on screen
let projectsRouted = false;

export function initProjects() {
  const section = document.querySelector('.ProjectSection');

  if (!section) {
    return;
  }

  // a phone keeps the screenshots. a desktop shows them in the cloud, so the
  // stage is an empty box the rig frames into
  section.innerHTML = `
    <div class="ProjectStage" aria-hidden="true">${mobile ? '<img class="ProjectShot" alt="">' : ''}</div>
    <ul class="ProjectCorners">${PROJECTS.map(corner).join('')}</ul>`;

  stage = section.querySelector('.ProjectStage');
  shot = section.querySelector('.ProjectShot');
  corners = [...section.querySelectorAll('.ProjectCorner')];
  corners.forEach((item, index) => {
    item.querySelector('.ProjectPick').addEventListener('click', () => selectProject(index));
  });

  paintProjects();
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
  const { shotMobile } = PROJECTS[selectedProject];

  stage.classList.toggle('is-model', selectedProject === MODEL_PROJECT);

  // the cloud project has no screenshot, and the class above hides the stage on
  // it, so the last one stays loaded underneath
  if (shot && shotMobile) {
    shot.src = shotMobile;
  }

  corners.forEach((item, index) => {
    const active = index === selectedProject;
    item.classList.toggle('is-active', active);
    item.querySelector('.ProjectPick').setAttribute('aria-pressed', String(active));
  });
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

  // on a phone the screenshot is the panel, so the cloud stays a backdrop
  // behind it and only comes forward for the cloud project
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

// a dated rail against a pinned cloud. the role crossing the line owns the mark

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
