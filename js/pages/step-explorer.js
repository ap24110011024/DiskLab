/*
 * Step Explorer: go through one algorithm a movement at a time with every
 * detail visible, jump to any step, and optionally predict the next decision.
 * The prediction challenge never blocks Next/Play.
 */

import { initPage } from '../app.js';
import { getWorkload } from '../state.js';
import { runOne } from '../simulation/engine.js';
import { createStepController } from '../simulation/step-controller.js';
import { createAnimationController } from '../simulation/animation-controller.js';
import { createPlaybackBar } from '../simulation/playback-bar.js';
import { createDiskTrack } from '../visualization/disk-track.js';
import { createMovementPath } from '../visualization/movement-path.js';
import { renderStepPanel, renderSequence, renderGuide } from '../learning/explanations.js';
import { buildPrediction } from '../learning/prediction-challenge.js';
import { ALGORITHM_INFO } from '../algorithms/index.js';
import { escapeHtml, prefersReducedMotion } from '../ui.js';

initPage('steps');

const $ = (id) => document.getElementById(id);
const workload = getWorkload();
const track = createDiskTrack($('track'), { compact: true });
let result; let controller; let animation; let bar; let path;
let score = { correct: 0, answered: 0 };
let lastKey = '';

function renderTable(step, progress) {
  const active = progress > 0 ? step : step - 1;
  $('step-rows').innerHTML = result.steps.map((s, i) => `
    <tr class="clickable${i === active ? ' is-current' : ''}" data-step="${s.number}" tabindex="0">
      <td class="num">${s.number}</td><td class="num">${s.from}</td><td class="num">${s.to}</td>
      <td>${s.type === 'BOUNDARY' ? '<span class="badge boundary">boundary</span>' : s.request.id}</td>
      <td>${s.direction === 'NONE' ? '-' : s.direction}</td><td class="num">${s.distance}</td><td class="num">${s.cumulative}</td>
      <td>${escapeHtml(s.title)}</td></tr>`).join('');
}

function draw(step, progress) {
  track.render(step, progress);
  path.render(step, progress);
  const key = `${step}|${progress > 0}`;
  if (key === lastKey) return;
  lastKey = key;
  renderStepPanel($('step-panel'), result, step, progress);
  renderSequence($('sequence'), result, step, progress);
  renderTable(step, progress);
  if (progress === 0) renderChallenge(step);
}

/* ---------- prediction challenge ---------- */
function renderChallenge(step) {
  const box = $('challenge');
  if (!$('challenge-toggle').checked) { box.innerHTML = '<p class="faint small">Turn on the challenge to predict each decision before it happens.</p>'; return; }
  const prediction = buildPrediction(result, step);
  if (!prediction) { box.innerHTML = `<p class="muted">All steps done. Score: <b>${score.correct} / ${score.answered}</b>.</p>`; return; }
  box.innerHTML = `
    <p class="challenge-q">${prediction.question} <span class="faint small">(step ${step + 1})</span></p>
    <div class="option-grid">${prediction.options.map((o) => `<button class="btn option" data-value="${o.value}">${o.label}</button>`).join('')}</div>
    <div class="challenge-feedback" aria-live="polite"></div>
    <div class="button-row"><button class="btn btn-small" data-challenge="skip">Skip</button></div>
    <p class="faint small">Score: ${score.correct} / ${score.answered}</p>`;

  box.onclick = (event) => {
    const option = event.target.closest('.option');
    const action = event.target.closest('[data-challenge]')?.dataset.challenge;
    const feedback = box.querySelector('.challenge-feedback');
    if (option && !option.disabled) {
      const right = option.dataset.value === prediction.correct;
      score.answered += 1;
      if (right) score.correct += 1;
      option.classList.add(right ? 'right' : 'wrong');
      if (right) {
        box.querySelectorAll('.option').forEach((b) => { b.disabled = true; });
        feedback.innerHTML = `<p class="notice success"><b>Correct.</b> ${escapeHtml(prediction.explanation)}</p>
          <button class="btn btn-small btn-primary" data-challenge="advance">Show this step</button>`;
      } else {
        option.disabled = true;
        feedback.innerHTML = `<p class="notice error"><b>Incorrect.</b> Think about the rule for ${result.algorithm}. Try again, or reveal the answer.</p>
          <button class="btn btn-small" data-challenge="retry">Try again</button>
          <button class="btn btn-small" data-challenge="reveal">Reveal answer</button>`;
      }
    }
    if (action === 'retry') feedback.innerHTML = '<p class="faint small">Pick another option.</p>';
    if (action === 'reveal') {
      feedback.innerHTML = `<p class="notice info"><b>${escapeHtml(prediction.title)}.</b> ${escapeHtml(prediction.explanation)}</p>
        <button class="btn btn-small btn-primary" data-challenge="advance">Show this step</button>`;
      box.querySelectorAll('.option').forEach((b) => { b.disabled = true; });
    }
    if (action === 'skip' || action === 'advance') animation.next();
  };
}

function load(name) {
  if (animation) animation.destroy();
  if (bar) bar.destroy();
  result = runOne(name, workload);
  lastKey = '';
  score = { correct: 0, answered: 0 };
  document.querySelectorAll('#algo-tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.algo === name)));
  $('algo-short').textContent = ALGORITHM_INFO[name].short;
  $('guide-title').textContent = `About ${name} (${ALGORITHM_INFO[name].name})`;
  renderGuide($('algo-guide'), name, result);
  track.setResult(result);
  path = createMovementPath($('seek-graph'), { color: ALGORITHM_INFO[name].color, rowHeight: 20, onStepClick: (s) => animation.goTo(s) });
  path.setResult(result);
  controller = createStepController(result.steps.length, draw);
  animation = createAnimationController(controller, { result, onStateChange: (s) => bar.update(s), reducedMotion: prefersReducedMotion() });
  bar = createPlaybackBar($('playback'), animation, { total: result.steps.length });
  $('jump-input').max = result.steps.length;
  controller.refresh();
  animation.emit();
}

$('algo-tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-algo]'); if (b) load(b.dataset.algo); });
$('step-rows').addEventListener('click', (e) => { const row = e.target.closest('tr'); if (row) animation.goTo(Number(row.dataset.step)); });
$('step-rows').addEventListener('keydown', (e) => { if (e.key === 'Enter') { const row = e.target.closest('tr'); if (row) animation.goTo(Number(row.dataset.step)); } });
$('jump-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const value = Number($('jump-input').value);
  if (!Number.isInteger(value) || value < 0 || value > result.steps.length) {
    $('jump-error').textContent = `Enter a step from 0 to ${result.steps.length}.`;
    return;
  }
  $('jump-error').textContent = '';
  animation.goTo(value);
});
$('challenge-toggle').addEventListener('change', () => renderChallenge(controller.step));

const requested = new URLSearchParams(window.location.search).get('algo');
load(['SSTF', 'SCAN', 'LOOK'].includes(requested) ? requested : 'SSTF');
