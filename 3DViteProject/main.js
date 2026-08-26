import { initCloud } from './cloud.js';
import { initPage, initRouter, hasRoute } from './page.js';
import { initProjects, renderWork } from './sections.js';
import { initAnim, initIntro } from './animation.js';

// the panels and the work list have to exist before anything measures or routes
// to them
initPage();
initProjects();

// building it unrouted would hang scroll triggers off rows nothing can reach
if (hasRoute('work')) {
  renderWork();
}

initIntro();
initCloud(initAnim);
initRouter();
