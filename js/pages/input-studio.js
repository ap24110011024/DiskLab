/*
 * Input Studio: edit the shared workload (disk size, head, direction and the
 * request queue). Nothing invalid can be saved; the other pages read the
 * saved workload through state.js.
 */

import { initPage } from '../app.js';
import { getWorkload, setWorkload, nextRequestId, withIds, SAMPLE_WORKLOAD, copyWorkload } from '../state.js';
import { validateDiskSize, validateHead, parseCylinderList, validateCylinder, validateWorkload, LIMITS } from '../validation.js';
import { renderQueue } from '../input/queue-editor.js';
import { generateCylinders, WORKLOAD_TYPES, newSeed } from '../input/workload-generator.js';
import { createDiskTrack, makeTrackInteractive } from '../visualization/disk-track.js';
import { toast } from '../ui.js';

initPage('input');

const $ = (id) => document.getElementById(id);
let workload = getWorkload();

const track = createDiskTrack($('input-track'), { mode: 'input' });
$('input-track').classList.add('input-mode');
makeTrackInteractive(track, {
  onAdd: (cylinder) => addRequests([cylinder]),
  onHeadDrag: (cylinder) => { workload.initialHead = cylinder; syncHead(); },
});

function setError(field, message) {
  const box = $(`${field}-error`);
  box.textContent = message || '';
  box.closest('.field')?.classList.toggle('invalid', Boolean(message));
}

/** Saves the workload if it is valid and refreshes every view. */
function commit() {
  const check = validateWorkload(workload);
  setError('queue', check.errors.requests || '');
  if (check.errors.requests === undefined && check.isValid) {
    const saved = setWorkload(workload);
    $('save-state').textContent = saved.ok ? 'Saved. Every page now uses this workload.' : saved.error;
    $('save-state').className = saved.ok ? 'muted small' : 'error';
  } else {
    $('save-state').textContent = 'Not saved yet: fix the highlighted problems.';
    $('save-state').className = 'error';
  }
  document.querySelectorAll('[data-needs-valid]').forEach((link) => link.classList.toggle('disabled-link', !check.isValid));
  draw();
}

function draw() {
  track.setWorkload(workload);
  $('range-label').textContent = `Valid cylinders: 0 to ${workload.diskSize - 1}`;
  $('request-count').textContent = `${workload.requests.length} / ${LIMITS.MAX_REQUESTS} requests`;
  renderQueue($('queue-chips'), workload.requests, {
    onRemove: (id) => { workload.requests = workload.requests.filter((r) => r.id !== id); commit(); },
    onEdit: (id, text) => {
      if (text === null) { draw(); return; }
      const check = validateCylinder(text, workload.diskSize);
      if (check.error) { setError('queue', check.error); draw(); return; }
      workload.requests = workload.requests.map((r) => (r.id === id ? { ...r, cylinder: check.value } : r));
      commit();
    },
  });
  const arrow = $('direction-arrow');
  arrow.className = `dir-arrow ${workload.direction.toLowerCase()}`;
  document.querySelectorAll('[data-direction]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.direction === workload.direction)));
}

function syncDisk() {
  $('disk-number').value = workload.diskSize;
  $('disk-slider').value = Math.min(workload.diskSize, Number($('disk-slider').max));
  $('head-slider').max = workload.diskSize - 1;
  syncHead();
}

function syncHead() {
  $('head-number').value = workload.initialHead;
  $('head-slider').value = workload.initialHead;
  setError('head', '');
  commit();
}

function addRequests(cylinders) {
  const space = LIMITS.MAX_REQUESTS - workload.requests.length;
  if (space <= 0) { setError('queue', `The queue is full (${LIMITS.MAX_REQUESTS} requests).`); return; }
  for (const cylinder of cylinders.slice(0, space)) {
    workload.requests.push({ id: nextRequestId(workload.requests), cylinder });
  }
  if (cylinders.length > space) toast(`Only ${space} request(s) added: the queue limit is ${LIMITS.MAX_REQUESTS}.`, 'error');
  commit();
}

/** Disk size changes may push the head or requests out of range. */
function changeDiskSize(text) {
  const check = validateDiskSize(text);
  if (check.error) { setError('disk', check.error); return; }
  setError('disk', '');
  workload.diskSize = check.value;
  const outside = workload.requests.filter((r) => r.cylinder > check.value - 1).length;
  if (outside > 0) {
    workload.requests = workload.requests.filter((r) => r.cylinder <= check.value - 1);
    toast(`${outside} request(s) outside the new disk were removed.`, 'error');
  }
  if (workload.initialHead > check.value - 1) workload.initialHead = check.value - 1;
  syncDisk();
}

/* ---------- events ---------- */
$('disk-number').addEventListener('change', (e) => changeDiskSize(e.target.value));
$('disk-slider').addEventListener('input', (e) => changeDiskSize(e.target.value));
$('head-number').addEventListener('change', (e) => {
  const check = validateHead(e.target.value, workload.diskSize);
  if (check.error) { setError('head', check.error); return; }
  workload.initialHead = check.value;
  syncHead();
});
$('head-slider').addEventListener('input', (e) => { workload.initialHead = Number(e.target.value); syncHead(); });

$('add-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const parsed = parseCylinderList($('add-input').value, workload.diskSize);
  if (parsed.error) { setError('queue', parsed.error); return; }
  setError('queue', '');
  $('add-input').value = '';
  addRequests(parsed.value);
});

$('clear-queue').addEventListener('click', () => { workload.requests = []; commit(); });

document.querySelector('.direction-toggle').addEventListener('click', (event) => {
  const button = event.target.closest('[data-direction]');
  if (!button) return;
  workload.direction = button.dataset.direction;
  commit();
});

$('preset-type').innerHTML = Object.entries(WORKLOAD_TYPES).map(([value, info]) => `<option value="${value}">${info.label}</option>`).join('');
$('preset-type').addEventListener('change', () => { $('preset-hint').textContent = WORKLOAD_TYPES[$('preset-type').value].hint; });
$('preset-hint').textContent = WORKLOAD_TYPES.random.hint;

function generate(seed) {
  const count = Number($('preset-count').value);
  if (!Number.isInteger(count) || count < 1 || count > LIMITS.MAX_REQUESTS) {
    setError('preset', `Request count must be 1 to ${LIMITS.MAX_REQUESTS}.`);
    return;
  }
  setError('preset', '');
  $('preset-seed').value = seed;
  const cylinders = generateCylinders({ type: $('preset-type').value, diskSize: workload.diskSize, head: workload.initialHead, count, seed });
  workload.requests = withIds(cylinders);
  commit();
}
$('generate').addEventListener('click', () => generate(Number($('preset-seed').value) || newSeed()));
$('regenerate').addEventListener('click', () => generate(newSeed()));
$('reset-sample').addEventListener('click', () => { workload = copyWorkload(SAMPLE_WORKLOAD); syncDisk(); toast('Workload reset to the sample.', 'success'); });

$('preset-seed').value = newSeed();
syncDisk();
