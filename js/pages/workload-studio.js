/*
 * Workload Experiment Studio: generate repeatable workloads (seeded), see how
 * the three algorithms perform, save/load workloads, and compare every
 * workload type with the same settings and seed.
 */

import { initPage } from '../app.js';
import { getWorkload, setWorkload, withIds } from '../state.js';
import { generateCylinders, WORKLOAD_TYPES, newSeed } from '../input/workload-generator.js';
import { validateDiskSize, validateHead, LIMITS } from '../validation.js';
import { runAll } from '../simulation/engine.js';
import { lowestMovement } from '../simulation/comparison.js';
import { createDiskTrack } from '../visualization/disk-track.js';
import { renderChart } from '../analytics/charts.js';
import { listSavedWorkloads, saveNamedWorkload, deleteNamedWorkload } from '../storage.js';
import { ALGORITHMS, ALGORITHM_INFO } from '../algorithms/index.js';
import { comparisonCsv, downloadFile } from '../export/export-results.js';
import { escapeHtml, formatNumber, formatDate, toast } from '../ui.js';

initPage('workloads');

const $ = (id) => document.getElementById(id);
const COMPARE_TYPES = ['random', 'uniform', 'leftHeavy', 'rightHeavy', 'clustered', 'ascending', 'descending', 'boundaryHeavy', 'duplicates'];
const track = createDiskTrack($('ws-track'), { compact: true });
let current = null;
let results = null;

$('ws-type').innerHTML = Object.entries(WORKLOAD_TYPES).map(([v, info]) => `<option value="${v}">${info.label}</option>`).join('');
const showTypeHint = () => { $('ws-type-hint').textContent = WORKLOAD_TYPES[$('ws-type').value].hint; };
$('ws-type').addEventListener('change', showTypeHint);
showTypeHint();

function readSettings() {
  const errors = {};
  const disk = validateDiskSize($('ws-disk').value);
  if (disk.error) errors.disk = disk.error;
  const head = validateHead($('ws-head').value, disk.value);
  if (head.error) errors.head = head.error;
  const count = Number($('ws-count').value);
  if (!Number.isInteger(count) || count < 1 || count > LIMITS.MAX_REQUESTS) errors.count = `Use 1 to ${LIMITS.MAX_REQUESTS} requests.`;
  const seed = Number($('ws-seed').value);
  if (!Number.isInteger(seed) || seed < 0) errors.seed = 'Seed must be a whole number.';
  for (const field of ['disk', 'head', 'count', 'seed']) $(`ws-${field}-error`).textContent = errors[field] || '';
  if (Object.keys(errors).length) return null;
  return { type: $('ws-type').value, diskSize: disk.value, head: head.value, count, seed, direction: $('ws-direction').value };
}

function showWorkload(workload) {
  current = workload;
  results = runAll(workload);
  const best = lowestMovement(results);
  track.setWorkload(workload);
  $('ws-requests').textContent = workload.requests.map((r) => r.cylinder).join(', ');
  $('ws-results').innerHTML = ALGORITHMS.map((name) => {
    const r = results[name];
    return `<tr class="${best.names.includes(name) ? 'is-best' : ''}"><td><span class="badge ${name.toLowerCase()}">${name}</span></td>
      <td class="num">${r.totalMovement}</td><td class="num">${formatNumber(r.averageMovement)}</td><td class="num">${r.directionChanges}</td>
      <td class="num">${r.finalHead}</td></tr>`;
  }).join('');
}

function generate(seed = Number($('ws-seed').value)) {
  $('ws-seed').value = seed;
  const settings = readSettings();
  if (!settings) return;
  const cylinders = generateCylinders({ ...settings });
  showWorkload({ diskSize: settings.diskSize, initialHead: settings.head, direction: settings.direction, requests: withIds(cylinders) });
}

function compareTypes() {
  const settings = readSettings();
  if (!settings) return;
  const rows = COMPARE_TYPES.map((type) => {
    const cylinders = generateCylinders({ ...settings, type });
    const r = runAll({ diskSize: settings.diskSize, initialHead: settings.head, direction: settings.direction, requests: withIds(cylinders) });
    return { type, results: r, best: lowestMovement(r) };
  });
  $('ws-compare-table').innerHTML = rows.map((row) => `<tr><td>${WORKLOAD_TYPES[row.type].label}</td>
    ${ALGORITHMS.map((n) => `<td class="num${row.best.names.includes(n) ? ' best-cell' : ''}">${row.results[n].totalMovement}</td>`).join('')}</tr>`).join('');
  $('ws-compare').hidden = false;
  renderChart($('ws-chart'), {
    type: 'bar',
    data: {
      labels: rows.map((row) => WORKLOAD_TYPES[row.type].label),
      datasets: ALGORITHMS.map((n) => ({ label: n, data: rows.map((row) => row.results[n].totalMovement), backgroundColor: ALGORITHM_INFO[n].color })),
    },
    options: { scales: { y: { beginAtZero: true, title: { display: true, text: 'Total head movement (cylinders)' } } } },
  });
}

function renderSaved() {
  const { value: list, error } = listSavedWorkloads();
  if (error) { $('ws-saved').innerHTML = `<p class="error">${escapeHtml(error)}</p>`; return; }
  $('ws-saved').innerHTML = list.length === 0
    ? '<p class="faint small">No saved workloads yet.</p>'
    : list.map((item) => `<div class="saved-row"><div><b>${escapeHtml(item.name)}</b>
        <span class="faint small">${formatDate(item.savedAt)} · ${item.workload.requests.length} requests</span></div>
        <div class="button-row"><button class="btn btn-small" data-load="${item.id}">Load</button>
        <button class="btn btn-small btn-danger" data-delete="${item.id}">Delete</button></div></div>`).join('');
}

$('ws-generate').addEventListener('click', () => generate());
$('ws-regenerate').addEventListener('click', () => generate(newSeed()));
$('ws-reset').addEventListener('click', () => {
  $('ws-type').value = 'random'; showTypeHint(); $('ws-disk').value = 200; $('ws-head').value = 50; $('ws-count').value = 10;
  $('ws-direction').value = 'RIGHT'; $('ws-seed').value = 42;
  generate(42);
});
$('ws-compare-btn').addEventListener('click', () => {
  $('ws-compare').hidden = false;
  $('ws-compare-table').innerHTML = '<tr><td colspan="4"><div class="skeleton"></div></td></tr>'.repeat(4);
  setTimeout(compareTypes, 60);
});
$('ws-use').addEventListener('click', () => {
  const saved = setWorkload(current);
  toast(saved.ok ? 'This workload is now used by every page.' : saved.error, saved.ok ? 'success' : 'error');
});
$('ws-save').addEventListener('click', () => {
  const name = $('ws-name').value.trim() || `${WORKLOAD_TYPES[$('ws-type').value].label} (seed ${$('ws-seed').value})`;
  const saved = saveNamedWorkload(name, current);
  toast(saved.ok ? `Saved "${name}".` : saved.error, saved.ok ? 'success' : 'error');
  $('ws-name').value = '';
  renderSaved();
});
$('ws-saved').addEventListener('click', (event) => {
  const load = event.target.closest('[data-load]');
  const remove = event.target.closest('[data-delete]');
  if (load) {
    const item = listSavedWorkloads().value.find((w) => w.id === load.dataset.load);
    if (item) { showWorkload(item.workload); toast(`Loaded "${item.name}".`, 'success'); }
  }
  if (remove) { deleteNamedWorkload(remove.dataset.delete); renderSaved(); }
});
$('ws-export').addEventListener('click', () => downloadFile('disklab-workload-results.csv', comparisonCsv(results)));

// Start from the current workload's settings
const start = getWorkload();
$('ws-disk').value = start.diskSize;
$('ws-head').value = start.initialHead;
$('ws-direction').value = start.direction;
$('ws-count').value = 10;
$('ws-seed').value = 42;
showWorkload(start);
renderSaved();
