/*
 * Algorithm Arena: SSTF, SCAN and LOOK side by side on identical input.
 * Each lane has its own result, step controller and animation timer, so the
 * three runs stay mathematically independent; the buttons just send the same
 * command to all three.
 */

import { initPage } from '../app.js';
import { getWorkload } from '../state.js';
import { runAll } from '../simulation/engine.js';
import { lowestMovement } from '../simulation/comparison.js';
import { createStepController } from '../simulation/step-controller.js';
import { createAnimationController } from '../simulation/animation-controller.js';
import { createPlaybackBar } from '../simulation/playback-bar.js';
import { movementSoFar, activeStep } from '../simulation/execution-data.js';
import { createDiskTrack } from '../visualization/disk-track.js';
import { createMovementPath } from '../visualization/movement-path.js';
import { ALGORITHMS, ALGORITHM_INFO } from '../algorithms/index.js';
import { comparisonCsv, downloadFile } from '../export/export-results.js';
import { escapeHtml, formatNumber, prefersReducedMotion } from '../ui.js';
import { renderChart } from '../analytics/charts.js';
import { ALGORITHM_GUIDE } from '../learning/explanations.js';

initPage('arena');

const $ = (id) => document.getElementById(id);
const workload = getWorkload();
const results = runAll(workload);
const best = lowestMovement(results);
const lanes = {};

$('arena-input').textContent = `disk 0–${workload.diskSize - 1} · head ${workload.initialHead} · ${workload.direction} · ${workload.requests.map((r) => r.cylinder).join(', ')}`;

$('lanes').innerHTML = ALGORITHMS.map((name) => `
  <section class="lane" data-algo="${name}" style="--algo:${ALGORITHM_INFO[name].color}">
    <header class="lane-head">
      <h2>${name}</h2>
      <span class="lane-total"><span class="mono" id="total-${name}">0</span><span class="faint"> / ${results[name].totalMovement} cyl</span></span>
      <span class="badge best hidden" id="best-${name}">lowest for this workload</span>
      <a class="btn btn-small" href="simulator.html?algo=${name}">Inspect</a>
    </header>
    <div class="track-box" id="track-${name}"></div>
    <p class="lane-step" id="step-${name}">Ready</p>
    <details class="lane-path"><summary>Movement path</summary><div id="path-${name}"></div></details>
  </section>`).join('');

let finishedCount = 0;
function revealBest() {
  for (const name of best.names) $(`best-${name}`).classList.remove('hidden');
  document.querySelectorAll('.lane').forEach((lane) => lane.classList.toggle('is-best', best.names.includes(lane.dataset.algo)));
}

for (const name of ALGORITHMS) {
  const result = results[name];
  const track = createDiskTrack($(`track-${name}`), { compact: true });
  track.setResult(result);
  const path = createMovementPath($(`path-${name}`), { color: ALGORITHM_INFO[name].color, rowHeight: 16 });
  path.setResult(result);
  let lastStep = -1;
  const controller = createStepController(result.steps.length, (step, progress) => {
    track.render(step, progress);
    path.render(step, progress);
    $(`total-${name}`).textContent = formatNumber(Math.round(movementSoFar(result, step, progress)));
    if (step !== lastStep || progress === 0) {
      lastStep = step;
      const shown = activeStep(result, step, progress);
      $(`step-${name}`).textContent = step >= result.steps.length
        ? `Done: ${result.steps.length} movements, ${result.totalMovement} cylinders.`
        : shown ? `Step ${shown.number}/${result.steps.length}: ${shown.title}` : `Ready: ${result.steps.length} movements planned.`;
    }
  });
  const animation = createAnimationController(controller, {
    result,
    reducedMotion: prefersReducedMotion(),
    onStateChange: (state) => {
      lanes[name].state = state;
      if (state.finished) { finishedCount += 1; if (ALGORITHMS.every((n) => lanes[n]?.state?.finished)) revealBest(); }
      updateGroupBar();
    },
  });
  lanes[name] = { controller, animation, state: { playing: false, finished: false, step: 0, total: result.steps.length } };
  controller.refresh();
}

// One "player" that forwards each command to the three lanes.
const group = {
  toggle() { const anyPlaying = ALGORITHMS.some((n) => lanes[n].animation.playing); ALGORITHMS.forEach((n) => (anyPlaying ? lanes[n].animation.pause() : lanes[n].animation.play())); },
  next() { ALGORITHMS.forEach((n) => lanes[n].animation.next()); },
  previous() { ALGORITHMS.forEach((n) => lanes[n].animation.previous()); },
  reset() { ALGORITHMS.forEach((n) => lanes[n].animation.reset()); },
  replay() { ALGORITHMS.forEach((n) => lanes[n].animation.replay()); },
  goTo(step) { ALGORITHMS.forEach((n) => lanes[n].animation.goTo(Math.min(step, lanes[n].controller.total))); },
  setSpeed(value) { ALGORITHMS.forEach((n) => lanes[n].animation.setSpeed(value)); },
};
const longest = Math.max(...ALGORITHMS.map((n) => results[n].steps.length));
const bar = createPlaybackBar($('playback'), group, { total: longest });

function updateGroupBar() {
  const states = ALGORITHMS.map((n) => lanes[n].state);
  bar.update({
    playing: states.some((s) => s.playing),
    finished: states.every((s) => s.finished),
    step: Math.max(...states.map((s) => s.step)),
    total: longest,
  });
}
updateGroupBar();

/* Results table and path chart (calculated values, visible from the start) */
$('arena-table').innerHTML = ALGORITHMS.map((name) => {
  const r = results[name];
  return `<tr class="${best.names.includes(name) ? 'is-best' : ''}">
    <td><span class="badge ${name.toLowerCase()}">${name}</span></td>
    <td class="num">${r.totalMovement}</td><td class="num">${formatNumber(r.averageMovement)}</td>
    <td class="num">${r.directionChanges}</td><td class="num">${r.finalHead}</td>
    <td class="mono">${escapeHtml(r.path.join(' → '))}</td></tr>`;
}).join('');
$('arena-note').textContent = best.names.length === 3
  ? 'All three algorithms move the same distance on this workload.'
  : `${best.names.join(' and ')} moves the least on this workload. Change the workload and the ranking can change; this does not make it the best algorithm in general.`;

renderChart($('arena-chart'), {
  type: 'line',
  data: {
    labels: Array.from({ length: longest + 1 }, (_, i) => (i === 0 ? 'start' : `step ${i}`)),
    datasets: ALGORITHMS.map((name) => ({
      label: name, data: results[name].path, borderColor: ALGORITHM_INFO[name].color, backgroundColor: ALGORITHM_INFO[name].color, tension: 0, pointRadius: 3,
    })),
  },
  options: { scales: { y: { min: 0, max: workload.diskSize - 1, title: { display: true, text: 'Cylinder' } } }, interaction: { mode: 'index', intersect: false } },
});
renderChart($('arena-total-chart'), {
  type: 'bar',
  data: { labels: ALGORITHMS, datasets: [{ label: 'Total head movement', data: ALGORITHMS.map((n) => results[n].totalMovement), backgroundColor: ALGORITHMS.map((n) => ALGORITHM_INFO[n].color) }] },
  options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, title: { display: true, text: 'Cylinders' } } } },
});

// Reasons calculated from the three results, so they always match the numbers above.
const why = [];
const scan = results.SCAN;
const look = results.LOOK;
const boundary = scan.steps.find((s) => s.type === 'BOUNDARY');
if (boundary) why.push(`SCAN travels ${boundary.distance} cylinders from ${boundary.from} to the edge (${boundary.to}) with no request there; LOOK turns at ${boundary.from} instead, so SCAN moves ${scan.totalMovement - look.totalMovement} more.`);
else why.push(`SCAN makes no empty trip to the edge on this workload, so SCAN and LOOK move ${scan.totalMovement} and ${look.totalMovement} cylinders.`);
const sstf = results.SSTF;
why.push(`SSTF changes direction ${sstf.directionChanges} time${sstf.directionChanges === 1 ? '' : 's'}; SCAN and LOOK at most once. Fewer reversals keep sweeps predictable, but a greedy nearest choice can still win on total distance.`);
const biggest = ALGORITHMS.map((n) => ({ n, step: results[n].steps.reduce((a, b) => (b.distance > (a?.distance ?? -1) ? b : a), null) }))
  .filter((x) => x.step);
for (const { n, step } of biggest) why.push(`${n}'s longest single seek is ${step.distance} cylinders (${step.from} → ${step.to}).`);
why.push(`Lowest total on this workload: ${best.names.join(' and ')} (${best.lowest} cylinders). A different head position, direction or queue can change the ranking.`);
$('arena-why').innerHTML = why.map((w) => `<li>${escapeHtml(w)}</li>`).join('');

$('arena-proscons').innerHTML = ALGORITHMS.map((n) => `<tr><td><span class="badge ${n.toLowerCase()}">${n}</span></td>
  <td><ul class="plain-list">${ALGORITHM_GUIDE[n].pros.map((p) => `<li>${escapeHtml(p)}</li>`).join('')}</ul></td>
  <td><ul class="plain-list">${ALGORITHM_GUIDE[n].cons.map((p) => `<li>${escapeHtml(p)}</li>`).join('')}</ul></td></tr>`).join('');

$('export-csv').addEventListener('click', () => downloadFile('disklab-comparison.csv', comparisonCsv(results)));
