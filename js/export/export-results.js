/*
 * Export helpers. Everything exported comes from a real execution result.
 */

import { formatNumber } from '../ui.js';

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    // Fallback for browsers that block the clipboard API on http pages.
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (copyError) { ok = false; }
    area.remove();
    return ok;
  }
}

export const serviceSequenceText = (result) => result.serviceOrder.join(', ');
export const movementPathText = (result) => result.path.join(' -> ');

function csvCell(value) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(rows) {
  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}

export function downloadFile(filename, content, type = 'text/csv') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** One row per movement step of one algorithm. */
export function stepsCsv(result) {
  const rows = [
    ['algorithm', result.algorithm, 'disk size', result.diskSize, 'initial head', result.initialHead, 'direction', result.direction],
    ['step', 'type', 'from', 'to', 'distance', 'cumulative', 'request id', 'decision'],
  ];
  for (const step of result.steps) {
    rows.push([step.number, step.type, step.from, step.to, step.distance, step.cumulative, step.request ? step.request.id : '', step.title]);
  }
  rows.push([]);
  rows.push(['total head movement', result.totalMovement, 'average per request', result.averageMovement, 'direction changes', result.directionChanges, 'final head', result.finalHead]);
  return toCsv(rows);
}

/** One row per algorithm. results = { SSTF, SCAN, LOOK } */
export function comparisonCsv(results) {
  const rows = [['algorithm', 'total head movement', 'average per request', 'requests serviced', 'direction changes', 'final head', 'service order', 'head path']];
  for (const result of Object.values(results)) {
    rows.push([result.algorithm, result.totalMovement, result.averageMovement, result.servicedCount,
      result.directionChanges, result.finalHead, result.serviceOrder.join(' '), result.path.join(' ')]);
  }
  return toCsv(rows);
}

/** Saves a Chart.js chart as PNG. */
export function downloadChartImage(chart, filename) {
  if (!chart) return false;
  const anchor = document.createElement('a');
  anchor.href = chart.toBase64Image('image/png', 1);
  anchor.download = filename;
  anchor.click();
  return true;
}

/** Fills the hidden print summary and opens the browser print dialog. */
export function printSummary(container, result) {
  container.innerHTML = `
    <h1>DiskLab simulation summary</h1>
    <p>${result.algorithm}, disk 0 to ${result.diskSize - 1}, head ${result.initialHead}, direction ${result.direction}</p>
    <p>Requests: ${result.requests.map((r) => r.cylinder).join(', ')}</p>
    <p>Head path: ${result.path.join(' → ')}</p>
    <p>Total head movement: ${formatNumber(result.totalMovement)} cylinders.
       Average per request: ${formatNumber(result.averageMovement)}. Direction changes: ${result.directionChanges}.</p>
    <table><thead><tr><th>Step</th><th>From</th><th>To</th><th>Distance</th><th>Cumulative</th><th>Decision</th></tr></thead>
    <tbody>${result.steps.map((s) => `<tr><td>${s.number}</td><td>${s.from}</td><td>${s.to}</td><td>${s.distance}</td><td>${s.cumulative}</td><td>${s.title}</td></tr>`).join('')}</tbody></table>`;
  window.print();
}
