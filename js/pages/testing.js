/*
 * Testing Playground: runs the real algorithms against the test cases in
 * js/testing/test-cases.js and shows expected vs actual with PASS / FAIL.
 */

import { initPage } from '../app.js';
import { runTestCases, runRandomChecks } from '../testing/test-runner.js';
import { escapeHtml } from '../ui.js';

initPage('testing');

const $ = (id) => document.getElementById(id);

function run() {
  const started = performance.now();
  const rows = runTestCases();
  const random = runRandomChecks(300);
  const passed = rows.filter((r) => r.pass).length;
  const elapsed = Math.round(performance.now() - started);

  $('test-rows').innerHTML = rows.map((r) => `
    <tr><td>${escapeHtml(r.test)}</td><td><span class="badge ${r.algorithm.toLowerCase()}">${r.algorithm}</span></td>
      <td class="mono">${escapeHtml(r.expected)}</td><td class="mono">${escapeHtml(r.actual)}</td>
      <td><span class="badge ${r.pass ? 'pass' : 'fail'}">${r.pass ? 'PASS' : 'FAIL'}</span></td></tr>`).join('');

  const allPass = passed === rows.length && random.failures.length === 0;
  $('test-summary').className = `notice ${allPass ? 'success' : 'error'}`;
  $('test-summary').innerHTML = `<p><b>${passed} / ${rows.length}</b> test checks passed.
    Random check: <b>${random.count - new Set(random.failures.map((f) => JSON.stringify(f.input))).size} / ${random.count}</b> random workloads satisfied every rule.
    <span class="faint">(${elapsed} ms)</span></p>
    ${random.failures.length ? `<p class="error">First failure: ${escapeHtml(JSON.stringify(random.failures[0]))}</p>` : ''}`;
}

function runWithSkeleton() {
  $('test-rows').innerHTML = '<tr><td colspan="5"><div class="skeleton"></div></td></tr>'.repeat(3);
  $('test-summary').className = 'notice';
  $('test-summary').textContent = 'Running tests…';
  setTimeout(run, 60); // give the browser a frame to show the loading rows
}
$('run-tests').addEventListener('click', runWithSkeleton);
runWithSkeleton();
