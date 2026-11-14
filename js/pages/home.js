/*
 * Home page. The hero platter runs a real SSTF execution on the sample
 * workload in a loop, so even the landing animation follows the algorithm.
 */

import { initPage } from '../app.js';
import { SAMPLE_WORKLOAD } from '../state.js';
import { runAll } from '../simulation/engine.js';
import { createStepController } from '../simulation/step-controller.js';
import { createAnimationController } from '../simulation/animation-controller.js';
import { headPositionAt, servicedIds, phaseOf, movementSoFar } from '../simulation/execution-data.js';
import { createPlatter3D, requestPosition } from '../visualization/disk-platter-3d.js';
import { createMovementPath } from '../visualization/movement-path.js';
import { ALGORITHMS, ALGORITHM_INFO } from '../algorithms/index.js';
import { prefersReducedMotion } from '../ui.js';

initPage('home');

const results = runAll(SAMPLE_WORKLOAD);
const demo = results.SSTF;
const caption = document.getElementById('hero-caption');

const platter = createPlatter3D(document.getElementById('hero-platter'), { controls: false, bands: 8 });
platter.setWorkload(SAMPLE_WORKLOAD);

// Label every request on the platter itself, just above its dot (same formula as the dots).
platter.setLabels(SAMPLE_WORKLOAD.requests.map((r, i) => {
  const { x, y } = requestPosition(i, r.cylinder, SAMPLE_WORKLOAD.diskSize);
  return { text: `cyl ${r.cylinder}`, x, y: y - 6 };
}));

const controller = createStepController(demo.steps.length, (step, progress) => {
  const current = progress > 0 ? demo.steps[step] : null;
  platter.update({
    head: headPositionAt(demo, step, progress),
    previousHead: phaseOf(progress).name === 'move' && current ? current.from : null,
    targetId: current?.request?.id ?? null,
    servicedIds: servicedIds(demo, step, progress),
  });
  const now = Math.round(headPositionAt(demo, step, progress));
  caption.textContent = `SSTF live · head at ${now} · moved ${Math.round(movementSoFar(demo, step, progress))} of ${demo.totalMovement} cylinders`;
});

const animation = createAnimationController(controller, {
  result: demo,
  reducedMotion: false,
  onStateChange: ({ finished }) => {
    if (finished) setTimeout(() => animation.replay(), 1800);
  },
});

if (prefersReducedMotion()) {
  controller.goTo(demo.steps.length);
} else {
  animation.setSpeed(0.8);
  animation.play();
}

// Algorithm introduction: real results on the sample workload.
document.getElementById('algo-intro').innerHTML = ALGORITHMS.map((name) => `
  <article class="algo-card tilt" style="--algo:${ALGORITHM_INFO[name].color}">
    <header><h3>${name}</h3><span class="mono">${results[name].totalMovement} cyl</span></header>
    <p>${ALGORITHM_INFO[name].short}</p>
    <div class="mini-path" id="mini-${name}"></div>
    <p class="mono path-text">${results[name].path.join(' → ')}</p>
    <a class="btn btn-small" href="pages/simulator.html?algo=${name}">Simulate ${name}</a>
  </article>`).join('');

for (const name of ALGORITHMS) {
  const graph = createMovementPath(document.getElementById(`mini-${name}`), { color: ALGORITHM_INFO[name].color, rowHeight: 20 });
  graph.setResult(results[name]);
  graph.render(results[name].steps.length, 0);
}
