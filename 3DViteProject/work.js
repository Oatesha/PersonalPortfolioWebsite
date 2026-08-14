import { JOBS } from './content.js';
import { buildMark } from './markTargets.js';
import { showMark, clearMark } from './attractors.js';

// the work history list. picking a job expands it and reforms the cloud into
// that company's mark

let selected = null;
// building a mark is async, so only the newest pick reaches the cloud
let pickToken = 0;

function escapeHtml(text) {
  return text.replace(/[&<>"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
  })[character]);
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

function paint(open) {
  document.querySelectorAll('.Job').forEach((item) => {
    const isOpen = Number(item.dataset.job) === open;
    item.classList.toggle('is-open', isOpen);
    item.querySelector('.JobToggle').setAttribute('aria-expanded', String(isOpen));
    item.querySelector('.JobDetail').hidden = !isOpen;
  });
}

async function pick(index) {
  // pressing the open job closes it
  const next = selected === index ? null : index;
  selected = next;
  paint(next);

  const token = ++pickToken;

  if (next === null) {
    clearMark();
    return;
  }

  const job = JOBS[next];
  const mark = await buildMark(job.mark, job.accent);

  if (!mark || token !== pickToken) {
    return;
  }

  showMark(mark.texture, mark.framing);
}

// drops the selection and puts the ship back without going through pick
export function leaveWork() {
  if (selected === null) {
    return;
  }

  selected = null;
  pickToken++;
  paint(null);
  clearMark();
}

export function renderWork() {
  const section = document.querySelector('.WorkSection');

  if (!section) {
    return;
  }

  section.innerHTML = `
    <div class="WorkContent">
      <h4 class="WorkHeading">Work</h4>
      <ol class="JobList">${JOBS.map(jobItem).join('')}</ol>
    </div>
    <div class="WorkStage" aria-hidden="true"></div>`;

  section.querySelectorAll('.JobToggle').forEach((button) => {
    button.addEventListener('click', () => pick(Number(button.closest('.Job').dataset.job)));
  });
}
