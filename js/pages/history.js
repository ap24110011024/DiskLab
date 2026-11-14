/*
 * Simulation history stored in LocalStorage (see storage.js).
 * View, open, replay, delete one record, or clear everything.
 */

import { initPage } from '../app.js';
import { listHistory, deleteHistory, clearHistory, getHistory } from '../storage.js';
import { setWorkload } from '../state.js';
import { escapeHtml, formatNumber, formatDate, confirmDialog, showDialog, toast } from '../ui.js';

initPage('history');

const $ = (id) => document.getElementById(id);

function render() {
  const { value: list, ok, error } = listHistory();
  $('history-error').innerHTML = ok ? '' : `<p class="notice error">${escapeHtml(error)}</p>`;
  $('clear-history').disabled = list.length === 0;
  $('history-count').textContent = list.length ? `${list.length} saved simulation${list.length === 1 ? '' : 's'}` : '';

  if (list.length === 0) {
    $('history-list').innerHTML = `<div class="empty"><h3>No simulations saved yet</h3>
      <p>A simulation is saved automatically when it plays to the end in the Simulation Lab.</p>
      <a class="btn btn-primary" href="simulator.html">Open the Simulation Lab</a></div>`;
    return;
  }
  $('history-list').innerHTML = `<div class="table-wrap"><table>
    <thead><tr><th>Date</th><th>Algorithm</th><th class="num">Disk</th><th class="num">Head</th><th>Direction</th>
      <th>Request queue</th><th>Service sequence</th><th class="num">Total</th><th class="num">Avg</th><th></th></tr></thead>
    <tbody>${list.map((item) => `<tr>
      <td class="nowrap">${formatDate(item.date)}</td>
      <td><span class="badge ${item.algorithm.toLowerCase()}">${item.algorithm}</span></td>
      <td class="num">${item.workload.diskSize}</td><td class="num">${item.workload.initialHead}</td><td>${item.workload.direction}</td>
      <td class="mono">${escapeHtml(item.workload.requests.map((r) => r.cylinder).join(', '))}</td>
      <td class="mono">${escapeHtml(item.serviceSequence.join(', '))}</td>
      <td class="num">${item.totalMovement}</td><td class="num">${formatNumber(item.averageMovement)}</td>
      <td class="actions"><div class="button-row">
        <button class="btn btn-small" data-act="view" data-id="${item.id}">View</button>
        <a class="btn btn-small" href="simulator.html?history=${item.id}">Open</a>
        <a class="btn btn-small" href="simulator.html?history=${item.id}&play=1">Replay</a>
        <button class="btn btn-small" data-act="use" data-id="${item.id}">Use workload</button>
        <button class="btn btn-small btn-danger" data-act="delete" data-id="${item.id}">Delete</button></div></td>
    </tr>`).join('')}</tbody></table></div>`;
}

$('history-list').addEventListener('click', async (event) => {
  const button = event.target.closest('[data-act]');
  if (!button) return;
  const item = getHistory(button.dataset.id);
  if (!item) { toast('That record no longer exists.', 'error'); render(); return; }

  if (button.dataset.act === 'view') {
    showDialog(`<h2>${item.algorithm} simulation</h2>
      <dl class="facts">
        <div><dt>Saved</dt><dd>${formatDate(item.date)}</dd></div>
        <div><dt>Disk size</dt><dd>${item.workload.diskSize} (0–${item.workload.diskSize - 1})</dd></div>
        <div><dt>Initial head</dt><dd>${item.workload.initialHead}</dd></div>
        <div><dt>Direction</dt><dd>${item.workload.direction}</dd></div>
        <div class="wide"><dt>Request queue (id: cylinder)</dt><dd>${escapeHtml(item.workload.requests.map((r) => `${r.id}: ${r.cylinder}`).join(', '))}</dd></div>
        <div class="wide"><dt>Service sequence</dt><dd>${escapeHtml(item.serviceSequence.join(', '))}</dd></div>
        <div><dt>Total head movement</dt><dd>${item.totalMovement} cylinders</dd></div>
        <div><dt>Average per request</dt><dd>${formatNumber(item.averageMovement)}</dd></div>
      </dl>
      <div class="button-row"><a class="btn btn-primary" href="simulator.html?history=${item.id}&play=1">Replay this simulation</a></div>`);
  }
  if (button.dataset.act === 'use') {
    const saved = setWorkload(item.workload);
    toast(saved.ok ? 'Workload loaded. Every page now uses it.' : saved.error, saved.ok ? 'success' : 'error');
  }
  if (button.dataset.act === 'delete') {
    const result = deleteHistory(item.id);
    toast(result.ok ? 'Record deleted.' : result.error, result.ok ? 'success' : 'error');
    render();
  }
});

$('clear-history').addEventListener('click', async () => {
  const sure = await confirmDialog({ title: 'Clear all history?', message: 'Every saved simulation will be removed from this browser. This cannot be undone.', confirmText: 'Clear history' });
  if (!sure) return;
  const result = clearHistory();
  toast(result.ok ? 'History cleared.' : result.error, result.ok ? 'success' : 'error');
  render();
});

render();
