import { initCloud } from './cloud.js';
import { initPage, initRouter } from './page.js';
import { initProjects, renderWork } from './sections.js';
import { initAnim } from './animation.js';

// the panels and the work list have to exist before anything measures or routes
// to them
initPage();
initProjects();
renderWork();
initCloud(initAnim);
initRouter();
