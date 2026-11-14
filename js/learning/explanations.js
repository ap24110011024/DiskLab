/*
 * Explanation panels built from the execution result. The algorithm writes
 * each step's reason while it runs; these functions only display it, so the
 * explanation always matches the calculation.
 */

import { escapeHtml, formatNumber } from '../ui.js';
import { phaseOf, activeStep, movementSoFar } from '../simulation/execution-data.js';

const DIRECTION_TEXT = { LEFT: '◀ Left (towards 0)', RIGHT: 'Right (towards the end) ▶', NONE: 'No movement' };

/** SSTF distance table: every candidate with |head - cylinder|. */
export function candidateTable(step) {
  if (!step || step.candidates.length === 0) return '';
  const rows = step.candidates.slice(0, 10).map((c) => `
    <tr class="${step.request && c.id === step.request.id ? 'is-best' : ''}">
      <td class="mono">${c.id}</td><td class="num">${c.cylinder}</td>
      <td class="mono">|${step.from} − ${c.cylinder}|</td><td class="num">${c.distance}</td></tr>`).join('');
  const more = step.candidates.length > 10 ? `<p class="faint small">${step.candidates.length - 10} more candidates not shown.</p>` : '';
  return `<div class="table-wrap"><table><thead><tr><th>Id</th><th class="num">Cylinder</th><th>Distance formula</th><th class="num">Distance</th></tr></thead>
    <tbody>${rows}</tbody></table></div>${more}`;
}

/** Full step panel used by the Simulation Lab and the Step Explorer. */
export function renderStepPanel(container, result, step, progress) {
  const shown = activeStep(result, step, progress);
  if (!shown) {
    container.innerHTML = `
      <p class="step-status">Ready · ${result.steps.length} movement${result.steps.length === 1 ? '' : 's'} planned</p>
      <dl class="facts">
        <div><dt>Head starts at</dt><dd>${result.initialHead}</dd></div>
        <div><dt>Initial direction</dt><dd>${result.algorithm === 'SSTF' ? 'not used by SSTF' : DIRECTION_TEXT[result.direction]}</dd></div>
        <div class="wide"><dt>Pending requests</dt><dd>${result.requests.map((r) => r.cylinder).join(', ')}</dd></div>
      </dl>
      <p class="reason">Press <kbd>Space</kbd> or Play to watch every decision, or Next to go one movement at a time.</p>`;
    return;
  }
  const phase = progress > 0 ? phaseOf(progress).name : 'done';
  const finishedAll = step >= result.steps.length;
  const phaseText = { decide: 'deciding', move: 'moving', settle: 'arrived', done: 'completed' }[phase];

  container.innerHTML = `
    <p class="step-status">Step ${shown.number} of ${result.steps.length} · ${phaseText}
      ${shown.type === 'BOUNDARY' ? '<span class="badge boundary">boundary</span>' : ''}
      ${shown.reverseAfter ? '<span class="badge look">reversal</span>' : ''}</p>
    <h3 class="decision">${escapeHtml(shown.title)}</h3>
    <dl class="facts">
      <div><dt>Previous head</dt><dd>${shown.from}</dd></div>
      <div><dt>Target</dt><dd>${shown.type === 'BOUNDARY' ? `${shown.to} (boundary)` : `${shown.to} (${shown.request.id})`}</dd></div>
      <div><dt>Direction</dt><dd>${DIRECTION_TEXT[shown.direction]}</dd></div>
      <div><dt>Movement</dt><dd>|${shown.from} − ${shown.to}| = ${shown.distance}</dd></div>
      <div><dt>Cumulative</dt><dd>${formatNumber(Math.round(movementSoFar(result, step, progress)))} / ${formatNumber(result.totalMovement)}</dd></div>
      <div><dt>Remaining after</dt><dd>${shown.pendingAfter.length}</dd></div>
      <div class="wide"><dt>Pending before this step</dt><dd>${shown.pendingBefore.length ? shown.pendingBefore.map((r) => `${r.cylinder}<small class="faint">(${r.id})</small>`).join(', ') : 'none'}</dd></div>
    </dl>
    <p class="reason">${escapeHtml(shown.reason)}</p>
    ${result.algorithm === 'SSTF' && shown.type === 'SERVICE' && shown.distance > 0 ? candidateTable(shown) : ''}
    ${finishedAll ? `<p class="notice success small">Finished. Total head movement ${formatNumber(result.totalMovement)} cylinders, average ${formatNumber(result.averageMovement)} per request.</p>` : ''}`;
}

/** Chips for the service sequence: done, current or upcoming. Boundary visits are dashed. */
export function renderSequence(container, result, step, progress) {
  const current = progress > 0 ? step : -1;
  container.innerHTML = `<span class="chip plain">${result.initialHead} start</span>` + result.steps.map((s, i) => {
    let cls = 'chip plain';
    if (s.type === 'BOUNDARY') cls += ' boundary';
    else if (i < step) cls += ' done';
    if (i === current) cls += ' current';
    return `<span class="${cls}" title="Step ${s.number}">${s.to}${s.type === 'BOUNDARY' ? ' edge' : ''}</span>`;
  }).join('');
}

/*
 * Short reference guide for each algorithm. The "On this workload" part is
 * calculated from the real execution result, never written by hand.
 */
export const ALGORITHM_GUIDE = {
  SSTF: {
    what: 'Serves the pending request that is closest to the current head position.',
    how: ['Work out |head − request| for every pending request.', 'Pick the smallest distance (tie: lower cylinder, then earlier in the queue).',
      'Move there, service the request and remove it from the queue.', 'Repeat until the queue is empty.'],
    pros: ['Usually much less head movement than serving requests in arrival order.', 'Simple greedy rule that is easy to compute.'],
    cons: ['Far requests can starve when new nearby requests keep arriving.', 'Not guaranteed to give the minimum total movement.', 'Ignores direction, so the head can zig-zag and waiting times vary a lot.'],
    used: 'Rarely used in pure form because of starvation. Its idea, serving nearby requests first, appears in schedulers that reorder queued requests and add deadlines or ageing to stay fair; drive firmware also reorders queued commands (for example SATA Native Command Queuing).',
  },
  SCAN: {
    what: 'Sweeps across the disk in one direction like a lift, servicing requests on the way, then reverses at the physical end.',
    how: ['Move in the current direction, servicing each request the head reaches.', 'If requests remain behind, continue to the disk boundary (0 or the last cylinder).',
      'Reverse and service the remaining requests on the way back.'],
    pros: ['No starvation: every request is reached within at most two sweeps.', 'Predictable behaviour with at most one reversal per pass.'],
    cons: ['Wastes movement travelling to an edge where nothing is requested.', 'A request just behind the head waits for a full sweep and back.', 'Middle cylinders are passed more often than the edges, so waiting is uneven.'],
    used: 'The classic "elevator" algorithm. Operating systems used the word elevator for their disk schedulers, and sweep-ordered dispatching (sorting requests by position) is still a building block of practical schedulers.',
  },
  LOOK: {
    what: 'Sweeps like SCAN but turns around at the last pending request instead of travelling to the disk edge.',
    how: ['Move in the current direction, servicing each request the head reaches.', 'Stop at the last pending request in that direction.',
      'Reverse and service the remaining requests.'],
    pros: ['Avoids SCAN\'s empty trip to the boundary, so it never moves more than SCAN on the same input.', 'Keeps the fair, predictable sweep pattern.'],
    cons: ['A request just behind the head still waits for the sweep to come back.', 'Must know where the furthest pending request is.', 'Waiting is still uneven between middle and edge cylinders (C-LOOK addresses this).'],
    used: 'Practical sweep schedulers behave like LOOK, because there is no reason to travel to an empty edge. Its circular variant, C-LOOK, is common in textbooks and real schedulers.',
  },
};

/** Guide card for one algorithm, ending with the real calculation for `result`. */
export function renderGuide(container, name, result) {
  const guide = ALGORITHM_GUIDE[name];
  const sum = result.distances.length ? `${result.distances.join(' + ')} = ${result.totalMovement}` : '0 (empty queue)';
  container.innerHTML = `
    <div class="guide">
      <p class="guide-what">${escapeHtml(guide.what)}</p>
      <div class="guide-grid">
        <section><h4>How it works</h4><ol>${guide.how.map((h) => `<li>${escapeHtml(h)}</li>`).join('')}</ol></section>
        <section><h4>Advantages</h4><ul class="pros">${guide.pros.map((h) => `<li>${escapeHtml(h)}</li>`).join('')}</ul></section>
        <section><h4>Disadvantages</h4><ul class="cons">${guide.cons.map((h) => `<li>${escapeHtml(h)}</li>`).join('')}</ul></section>
      </div>
      <section class="guide-used"><h4>Where it is used</h4><p>${escapeHtml(guide.used)}</p></section>
      <section class="guide-calc"><h4>On the current workload</h4>
        <p class="mono">${escapeHtml(result.path.join(' → '))}</p>
        <p class="mono">Total head movement = ${escapeHtml(sum)} cylinders · average ${formatNumber(result.averageMovement)} per request</p>
        <p class="small muted">Why each request is chosen is shown step by step in the explanation panel.</p>
      </section>
    </div>`;
}
