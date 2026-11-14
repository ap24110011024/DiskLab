/*
 * SCAN vs LOOK on the same input, animated together. The shaded band on the
 * SCAN track marks the extra trip to the disk boundary that LOOK avoids.
 */

import { initPage } from '../app.js';
import { getWorkload } from '../state.js';
import { runOne } from '../simulation/engine.js';
import { scanLookDifference } from '../simulation/comparison.js';
import { createStepController } from '../simulation/step-controller.js';
import { createAnimationController } from '../simulation/animation-controller.js';
import { createPlaybackBar } from '../simulation/playback-bar.js';
import { movementSoFar, activeStep } from '../simulation/execution-data.js';
import { createDiskTrack } from '../visualization/disk-track.js';
import { escapeHtml, formatNumber, prefersReducedMotion } from '../ui.js';

initPage('scanlook');

const $ = (id) => document.getElementById(id);
const workload = getWorkload();
const results = { SCAN: runOne('SCAN', workload), LOOK: runOne('LOOK', workload) };
const difference = scanLookDifference(results.SCAN, results.LOOK);
const NAMES = ['SCAN', 'LOOK'];
const sides = {};

$('sl-input').textContent = `disk 0–${workload.diskSize - 1} · head ${workload.initialHead} · ${workload.direction} · ${workload.requests.map((r) => r.cylinder).join(', ')}`;

// Explanation of the difference
if (difference.segment) {
  $('sl-difference').innerHTML = `SCAN travels from <b>${difference.segment.from}</b> to the boundary <b>${difference.segment.to}</b> before reversing.
    LOOK reverses at its last request instead, so SCAN moves <b>${difference.extra}</b> more cylinders on this workload
    (${results.SCAN.totalMovement} vs ${results.LOOK.totalMovement}).`;
} else {
  $('sl-difference').innerHTML = `SCAN makes no boundary trip here (no requests were left on the other side, or a request sits on the boundary),
    so both move <b>${results.SCAN.totalMovement}</b> cylinders.`;
}

for (const name of NAMES) {
  const result = results[name];
  const track = createDiskTrack($(`track-${name}`), { compact: true });
  track.setResult(result);
  // shade the extra segment on the SCAN track
  if (name === 'SCAN' && difference.segment) {
    const svg = track.svg;
    const x1 = Math.min(track.x(difference.segment.from), track.x(difference.segment.to));
    const x2 = Math.max(track.x(difference.segment.from), track.x(difference.segment.to));
    const shade = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    shade.setAttribute('x', x1); shade.setAttribute('width', x2 - x1);
    shade.setAttribute('y', 62); shade.setAttribute('height', 40); shade.setAttribute('class', 'extra-segment');
    svg.insertBefore(shade, svg.firstChild.nextSibling);
  }
  $(`steps-${name}`).innerHTML = result.steps.map((s) => `
    <li data-step="${s.number}" class="${s.type === 'BOUNDARY' ? 'boundary' : ''}">
      <span class="mono">${s.from} → ${s.to}</span> <span class="faint">(${s.distance})</span> ${escapeHtml(s.title)}</li>`).join('');

  const controller = createStepController(result.steps.length, (step, progress) => {
    track.render(step, progress);
    $(`total-${name}`).textContent = formatNumber(Math.round(movementSoFar(result, step, progress)));
    const shown = activeStep(result, step, progress);
    $(`steps-${name}`).querySelectorAll('li').forEach((li) => {
      const n = Number(li.dataset.step);
      li.classList.toggle('done', n <= step);
      li.classList.toggle('current', shown !== null && n === shown.number);
    });
  });
  const animation = createAnimationController(controller, {
    result, reducedMotion: prefersReducedMotion(), onStateChange: (state) => { sides[name].state = state; syncBar(); },
  });
  sides[name] = { controller, animation, state: { playing: false, finished: false, step: 0, total: result.steps.length } };
  $(`final-${name}`).textContent = `${result.totalMovement} cylinders · ${result.directionChanges} direction change(s)`;
  controller.refresh();
}

const pair = {
  toggle() { const anyPlaying = NAMES.some((n) => sides[n].animation.playing); NAMES.forEach((n) => (anyPlaying ? sides[n].animation.pause() : sides[n].animation.play())); },
  next() { NAMES.forEach((n) => sides[n].animation.next()); },
  previous() { NAMES.forEach((n) => sides[n].animation.previous()); },
  reset() { NAMES.forEach((n) => sides[n].animation.reset()); },
  replay() { NAMES.forEach((n) => sides[n].animation.replay()); },
  goTo(step) { NAMES.forEach((n) => sides[n].animation.goTo(Math.min(step, sides[n].controller.total))); },
  setSpeed(value) { NAMES.forEach((n) => sides[n].animation.setSpeed(value)); },
};
const longest = Math.max(results.SCAN.steps.length, results.LOOK.steps.length);
const bar = createPlaybackBar($('playback'), pair, { total: longest });
function syncBar() {
  const states = NAMES.map((n) => sides[n].state);
  bar.update({ playing: states.some((s) => s.playing), finished: states.every((s) => s.finished), step: Math.max(...states.map((s) => s.step)), total: longest });
}
syncBar();
