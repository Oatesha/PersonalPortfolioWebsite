import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { JOBS } from './content.js';
import { buildMark } from './markTargets.js';
import { showMark, clearMark } from './attractors.js';

gsap.registerPlugin(ScrollTrigger);

// a dated rail against a pinned cloud. the role crossing the line owns the mark

const ESCAPES = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
};

function escapeHtml(text) {
  return text.replace(/[&<>"]/g, (character) => ESCAPES[character]);
}

let selected = null;
let routed = false;
// building a mark is async, so only the newest pick reaches the cloud
let pickToken = 0;

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
    const cross = () => routed && select(index);

    item.querySelector('.JobToggle')
      .addEventListener('click', () => select(selected === index ? null : index));

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

function paint() {
  document.querySelectorAll('.Job').forEach((item) => {
    const isOpen = Number(item.dataset.job) === selected;
    item.classList.toggle('is-open', isOpen);
    item.querySelector('.JobToggle').setAttribute('aria-expanded', String(isOpen));
    item.querySelector('.JobDetail').hidden = !isOpen;
  });
}

// the rows have no layout while the route is hidden, so the triggers wait
export function enterWork() {
  routed = true;
  ScrollTrigger.refresh();
}

export function leaveWork() {
  routed = false;

  if (selected !== null) {
    select(null);
  }
}

async function select(index) {
  if (index === selected) {
    return;
  }

  selected = index;
  paint();

  const token = ++pickToken;

  if (index === null) {
    clearMark();
    return;
  }

  const job = JOBS[index];
  const mark = await buildMark(job.mark, job.accent);

  if (mark && token === pickToken) {
    showMark(mark.texture, mark.framing);
  }
}
