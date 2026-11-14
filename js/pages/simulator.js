/*
 * Simulation Lab: one algorithm on the current workload, shown at the same
 * moment on the 2D track, the seek graph, the 3D platter and the cylinder
 * view. Everything is driven by ONE step controller, so all views agree.
 */

import { initPage } from '../app.js';
import { getWorkload } from '../state.js';
import { runOne } from '../simulation/engine.js';
import { createStepController } from '../simulation/step-controller.js';
import { createAnimationController } from '../simulation/animation-controller.js';
import { createPlaybackBar } from '../simulation/playback-bar.js';
import { headPositionAt, servicedIds, activeStep, phaseOf, movementSoFar, directionAt } from '../simulation/execution-data.js';
import { createDiskTrack } from '../visualization/disk-track.js';
import { createMovementPath } from '../visualization/movement-path.js';
import { createPlatter3D } from '../visualization/disk-platter-3d.js';
import { createCylinderView } from '../visualization/cylinder-view.js';
import { renderStepPanel, renderSequence } from '../learning/explanations.js';
import { ALGORITHM_INFO } from '../algorithms/index.js';
import { addHistory, getHistory } from '../storage.js';
import { copyText, serviceSequenceText, movementPathText, downloadFile, stepsCsv, printSummary } from '../export/export-results.js';
import { toast, formatNumber, prefersReducedMotion } from '../ui.js';

initPage('simulator');

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(window.location.search);

// Workload: from a history record (?history=id) or the shared current workload.
let workload = getWorkload();
let algorithm = ['SSTF', 'SCAN', 'LOOK'].includes(params.get('algo')) ? params.get('algo') : 'SSTF';
let fromHistory = null;
if (params.get('history')) {
  fromHistory = getHistory(params.get('history'));
  if (fromHistory) {
    workload = fromHistory.workload;
    algorithm = fromHistory.algorithm;
    $('source-note').textContent = `Replaying history record from ${new Date(fromHistory.date).toLocaleString()}.`;
  } else {
    $('source-note').textContent = 'That history record no longer exists; showing the current workload instead.';
  }
}

const track = createDiskTrack($('track'));
const platter = createPlatter3D($('platter'), {
  onSelect: ({ cylinder, requestId }) => {
    $('selection-info').textContent = requestId
      ? `Selected request ${requestId} at cylinder ${cylinder}.`
      : `Selected around cylinder ${cylinder}.`;
    track.highlight(requestId);
    selectedRequestId = requestId;
    lastTextKey = '';
    cylinderView.update({ head: Math.round(headPositionAt(result, controller.step, controller.progress)), servicedIds: servicedIds(result, controller.step, controller.progress), selected: cylinder });
    selectedCylinder = cylinder;
  },
});
const cylinderView = createCylinderView($('cylinder-view'));
let selectedCylinder = null;
let selectedRequestId = null;

let result;
let controller;
let animation;
let bar;
let path;
let savedThisRun = false;
let lastTextKey = '';

function renderWorkloadSummary() {
  $('workload-summary').innerHTML = `
    <span>Disk <b class="mono">0–${workload.diskSize - 1}</b></span>
    <span>Head <b class="mono">${workload.initialHead}</b></span>
    <span>Direction <b class="mono">${workload.direction}</b></span>
    <span>Requests <b class="mono">${workload.requests.length}</b></span>`;
}

function draw(step, progress) {
  track.render(step, progress);
  path.render(step, progress);

  const head = headPositionAt(result, step, progress);
  const shown = activeStep(result, step, progress);
  const current = progress > 0 ? result.steps[step] : null;
  const done = servicedIds(result, step, progress);
  const phase = phaseOf(progress).name;
  platter.update({
    head,
    previousHead: phase === 'move' && current ? current.from : null,
    targetId: current?.request?.id ?? null,
    servicedIds: done,
    atBoundary: current?.type === 'BOUNDARY' && phase === 'settle',
  });

  // Text and the cylinder view only change when something visible changes.
  const key = `${step}|${phase}|${Math.round(head)}`;
  if (key === lastTextKey) return;
  lastTextKey = key;
  cylinderView.update({ head: Math.round(head), servicedIds: done, selected: selectedCylinder });
  $('stat-head').textContent = Math.round(head);
  $('stat-move').textContent = shown ? shown.distance : 0;
  $('stat-total').textContent = formatNumber(Math.round(movementSoFar(result, step, progress)));
  $('stat-remaining').textContent = result.requests.length - done.size;
  const direction = directionAt(result, step, progress);
  const indicator = $('direction-indicator');
  indicator.className = `direction-indicator ${direction ? direction.toLowerCase() : 'none'}`;
  indicator.querySelector('span').textContent = direction ? direction : 'nearest first';
  renderStepPanel($('explanation'), result, step, progress);
  renderQueueState(done, current?.request?.id ?? null);
  renderSequence($('sequence'), result, step, progress);
}

/** Every request with its id and state: pending, current target or serviced. */
function renderQueueState(done, targetId) {
  $('queue-count').textContent = `${done.size} of ${result.requests.length} serviced`;
  $('queue-state').innerHTML = result.requests.map((r) => {
    let cls = 'chip plain queue-chip';
    if (done.has(r.id)) cls += ' done';
    else if (r.id === targetId) cls += ' current';
    if (r.id === selectedRequestId) cls += ' selected-chip';
    return `<button type="button" class="${cls}" data-id="${r.id}" data-cylinder="${r.cylinder}">${r.cylinder} <span class="chip-id">${r.id}</span></button>`;
  }).join('');
}

/** Ready / Running / Paused / Completed, shown next to the page title. */
function updateStatus({ playing, finished, step }) {
  const pill = $('sim-status');
  const state = playing ? 'running' : finished && result.steps.length > 0 ? 'completed' : step > 0 || controller.progress > 0 ? 'paused' : 'ready';
  pill.dataset.state = state;
  pill.textContent = { ready: 'Ready', running: 'Running', paused: 'Paused', completed: 'Completed' }[state];
}

function onPlaybackState(state) {
  bar.update(state);
  updateStatus(state);
  if (state.finished && !savedThisRun && result.steps.length > 0 && !fromHistory) {
    savedThisRun = true;
    const saved = addHistory({
      algorithm,
      workload,
      serviceSequence: result.serviceOrder,
      totalMovement: result.totalMovement,
      averageMovement: result.averageMovement,
    });
    if (saved.ok) toast('Simulation saved to history.', 'success');
    else toast(saved.error, 'error');
  }
}

function load(name) {
  algorithm = name;
  if (animation) animation.destroy();
  if (bar) bar.destroy();
  result = runOne(algorithm, workload);
  savedThisRun = false;
  lastTextKey = '';

  document.querySelectorAll('#algo-tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.algo === name)));
  $('algo-name').textContent = ALGORITHM_INFO[name].name;
  $('algo-short').textContent = ALGORITHM_INFO[name].short;
  document.querySelector('.lab').dataset.algo = name;

  track.setResult(result);
  platter.setWorkload(workload);
  cylinderView.setWorkload(workload);
  path = createMovementPath($('seek-graph'), { color: ALGORITHM_INFO[name].color, rowHeight: 22, onStepClick: (s) => animation.goTo(s) });
  path.setResult(result);

  controller = createStepController(result.steps.length, draw);
  animation = createAnimationController(controller, { result, onStateChange: onPlaybackState, reducedMotion: prefersReducedMotion() });
  bar = createPlaybackBar($('playback'), animation, { total: result.steps.length });
  $('total-final').textContent = `${formatNumber(result.totalMovement)} cylinders total`;
  controller.refresh();
  animation.emit();
}

/* ---------- events ---------- */
$('algo-tabs').addEventListener('click', (event) => {
  const button = event.target.closest('[data-algo]');
  if (button && button.dataset.algo !== algorithm) load(button.dataset.algo);
});

document.querySelector('.view-tabs').addEventListener('click', (event) => {
  const tab = event.target.closest('[data-view]');
  if (!tab) return;
  document.querySelectorAll('.view-tabs button').forEach((b) => b.setAttribute('aria-selected', String(b === tab)));
  $('platter').hidden = tab.dataset.view !== 'platter';
  $('cylinder-view').hidden = tab.dataset.view !== 'cylinder';
});

$('queue-state').addEventListener('click', (event) => {
  const chip = event.target.closest('[data-id]');
  if (chip) platter.selectCylinder(Number(chip.dataset.cylinder), chip.dataset.id);
  controller.refresh();
});

$('export').addEventListener('click', async (event) => {
  const action = event.target.closest('[data-export]')?.dataset.export;
  if (!action) return;
  if (action === 'sequence') toast(await copyText(serviceSequenceText(result)) ? 'Service sequence copied.' : 'Copy failed.', 'success');
  if (action === 'path') toast(await copyText(movementPathText(result)) ? 'Movement path copied.' : 'Copy failed.', 'success');
  if (action === 'csv') downloadFile(`disklab-${algorithm.toLowerCase()}-steps.csv`, stepsCsv(result));
  if (action === 'print') printSummary($('print-summary'), result);
});

renderWorkloadSummary();
load(algorithm);
const startStep = Number(params.get('step'));
if (Number.isInteger(startStep) && startStep > 0) animation.goTo(startStep);
if (params.get('play') === '1') animation.play();
