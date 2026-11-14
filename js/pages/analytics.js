/*
 * Analytics: real metrics and four Chart.js charts for the current workload.
 * Clicking a point on a chart moves the small track to that step and
 * highlights the request that was serviced.
 */

import { initPage } from '../app.js';
import { getWorkload } from '../state.js';
import { runAll } from '../simulation/engine.js';
import { lowestMovement } from '../simulation/comparison.js';
import { createDiskTrack } from '../visualization/disk-track.js';
import { renderChart } from '../analytics/charts.js';
import { ALGORITHMS, ALGORITHM_INFO } from '../algorithms/index.js';
import { comparisonCsv, stepsCsv, downloadFile, downloadChartImage } from '../export/export-results.js';
import { escapeHtml, formatNumber, animateNumber } from '../ui.js';

initPage('analytics');

const $ = (id) => document.getElementById(id);
const workload = getWorkload();
const results = runAll(workload);
const best = lowestMovement(results);
const track = createDiskTrack($('an-track'), { compact: true });
const charts = {};
let algorithm = 'SSTF';

$('an-input').textContent = `disk 0–${workload.diskSize - 1} · head ${workload.initialHead} · ${workload.direction} · ${workload.requests.length} requests`;

/** Shows the given step of the selected algorithm on the small track. */
function showStep(step) {
  const result = results[algorithm];
  const s = Math.max(0, Math.min(step, result.steps.length));
  $('an-open').href = `simulator.html?algo=${algorithm}&step=${s}`;
  const shown = result.steps[s - 1];
  track.highlight(shown?.request?.id ?? null);
  track.render(s, 0);
  $('an-step').textContent = shown
    ? `Step ${s}: ${shown.from} → ${shown.to} (${shown.distance} cylinders, cumulative ${shown.cumulative}). ${shown.title}.`
    : `Start: head at ${result.initialHead}.`;
}

function chartClick(mapIndexToStep) {
  return (event, elements) => {
    if (elements.length) showStep(mapIndexToStep(elements[0].index));
  };
}

function renderMetrics(result) {
  const tiles = [
    ['Total head movement', result.totalMovement, 'cylinders'],
    ['Average per request', result.averageMovement, 'cylinders'],
    ['Requests serviced', result.servicedCount, ''],
    ['Direction changes', result.directionChanges, ''],
    ['Final head position', result.finalHead, ''],
  ];
  $('an-metrics').innerHTML = tiles.map(([label, value, unit], i) => `
    <div class="metric"><div class="label">${label}</div><div class="value"><span id="m-${i}">0</span><span class="unit">${unit}</span></div></div>`).join('');
  tiles.forEach(([, value], i) => {
    const element = $(`m-${i}`);
    if (Number.isInteger(value)) animateNumber(element, value);
    else element.textContent = formatNumber(value);
  });
  $('an-order').innerHTML = result.serviceSequence.map((r, i) => `<span class="chip plain" title="${r.id}">${i + 1}. ${r.cylinder}</span>`).join('');
}

function renderCharts(result) {
  const color = ALGORITHM_INFO[result.algorithm].color;

  charts.position = renderChart($('chart-position'), {
    type: 'line',
    data: { labels: result.path.map((_, i) => (i === 0 ? 'start' : String(i))),
      datasets: [{ label: `${result.algorithm} head position`, data: result.path, borderColor: color, backgroundColor: color, tension: 0, pointRadius: 4, pointHoverRadius: 7 }] },
    options: { onClick: chartClick((i) => i), scales: { x: { title: { display: true, text: 'Step' } }, y: { min: 0, max: result.diskSize - 1, title: { display: true, text: 'Cylinder' } } } },
  });

  charts.breakdown = renderChart($('chart-breakdown'), {
    type: 'bar',
    data: { labels: result.steps.map((s) => `${s.number}`),
      datasets: [{ label: 'Distance moved', data: result.distances,
        backgroundColor: result.steps.map((s) => (s.type === 'BOUNDARY' ? '#C29B55' : color)) }] },
    options: { onClick: chartClick((i) => i + 1), plugins: { legend: { display: false },
      tooltip: { callbacks: { afterLabel: (ctx) => result.steps[ctx.dataIndex].title } } },
    scales: { x: { title: { display: true, text: 'Step (mustard bar = boundary trip)' } }, y: { beginAtZero: true, title: { display: true, text: 'Cylinders' } } } },
  });

  const serviceSteps = result.steps.filter((s) => s.type === 'SERVICE');
  charts.sequence = renderChart($('chart-sequence'), {
    type: 'bar',
    data: { labels: serviceSteps.map((s, i) => `#${i + 1}`),
      datasets: [{ label: 'Cylinder serviced', data: serviceSteps.map((s) => s.to), backgroundColor: color }] },
    options: { onClick: chartClick((i) => serviceSteps[i].number), plugins: { legend: { display: false },
      tooltip: { callbacks: { afterLabel: (ctx) => `request ${serviceSteps[ctx.dataIndex].request.id}` } } },
    scales: { x: { title: { display: true, text: 'Service order' } }, y: { min: 0, max: result.diskSize - 1, title: { display: true, text: 'Cylinder' } } } },
  });
}

function renderComparison() {
  charts.total = renderChart($('chart-total'), {
    type: 'bar',
    data: { labels: ALGORITHMS, datasets: [{ label: 'Total head movement', data: ALGORITHMS.map((n) => results[n].totalMovement), backgroundColor: ALGORITHMS.map((n) => ALGORITHM_INFO[n].color) }] },
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, title: { display: true, text: 'Cylinders' } } } },
  });
  $('an-table').innerHTML = ALGORITHMS.map((n) => {
    const r = results[n];
    return `<tr class="${best.names.includes(n) ? 'is-best' : ''}"><td><span class="badge ${n.toLowerCase()}">${n}</span></td>
      <td class="num">${r.totalMovement}</td><td class="num">${formatNumber(r.averageMovement)}</td><td class="num">${r.servicedCount}</td>
      <td class="num">${r.directionChanges}</td><td class="num">${r.finalHead}</td><td class="mono">${escapeHtml(r.serviceOrder.join(', '))}</td></tr>`;
  }).join('');
}

function select(name) {
  algorithm = name;
  document.querySelectorAll('#algo-tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.algo === name)));
  track.setResult(results[name]);
  renderMetrics(results[name]);
  renderCharts(results[name]);
  showStep(0);
}

$('algo-tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-algo]'); if (b) select(b.dataset.algo); });
document.querySelector('.export-row').addEventListener('click', (event) => {
  const action = event.target.closest('[data-export]')?.dataset.export;
  if (action === 'comparison') downloadFile('disklab-comparison.csv', comparisonCsv(results));
  if (action === 'steps') downloadFile(`disklab-${algorithm.toLowerCase()}-steps.csv`, stepsCsv(results[algorithm]));
  if (action?.startsWith('chart-')) downloadChartImage(charts[action.slice(6)], `disklab-${action.slice(6)}.png`);
});

renderComparison();
select('SSTF');
