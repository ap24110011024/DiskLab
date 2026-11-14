/*
 * SSTF - Shortest Seek Time First.
 * At every step the head moves to the pending request closest to it.
 *   distance = |current head - request cylinder|
 * Ties: the lower cylinder wins; if cylinders are equal (duplicates), the
 * request that came first in the original queue wins.
 * SSTF does not use the initial direction.
 */

import { prepareInput, removeById, makeStep, buildExecution } from './common.js';

/** Every pending request with its distance, nearest first (ties as above). */
export function rankByDistance(pending, head) {
  return pending
    .map((r) => ({ id: r.id, cylinder: r.cylinder, order: r.order, distance: Math.abs(r.cylinder - head) }))
    .sort((a, b) => a.distance - b.distance || a.cylinder - b.cylinder || a.order - b.order);
}

function explain(head, ranked, chosen) {
  if (chosen.distance === 0) {
    return `The head is at ${head} and a pending request is also at cylinder ${head}. `
      + 'Its distance is 0, so SSTF services it immediately without moving.';
  }
  const shown = ranked.slice(0, 6).map((c) => `|${head} - ${c.cylinder}| = ${c.distance}`).join(', ');
  const more = ranked.length > 6 ? ` (and ${ranked.length - 6} farther requests)` : '';
  let text = `The head is at ${head}. Distances: ${shown}${more}. `
    + `The nearest pending request is ${chosen.cylinder}, ${chosen.distance} cylinders away, so SSTF selects it.`;
  const tied = ranked.filter((c) => c.distance === chosen.distance && c.cylinder !== chosen.cylinder);
  if (tied.length > 0) {
    text += ` Cylinder ${tied.map((c) => c.cylinder).join(' and ')} is just as close; the tie rule picks the lower cylinder.`;
  }
  return text;
}

export function runSSTF(rawInput) {
  const input = prepareInput(rawInput);
  let head = input.initialHead;
  let pending = [...input.requests];
  const steps = [];

  while (pending.length > 0) {
    const ranked = rankByDistance(pending, head);
    const chosen = ranked[0];
    const request = pending.find((r) => r.id === chosen.id);
    const pendingAfter = removeById(pending, chosen.id);

    steps.push(makeStep({
      type: 'SERVICE',
      from: head,
      to: chosen.cylinder,
      sweep: null,
      request,
      pendingBefore: pending,
      pendingAfter,
      candidates: ranked.map(({ id, cylinder, distance }) => ({ id, cylinder, distance })),
      title: `Nearest request: ${chosen.cylinder} (${chosen.distance} away)`,
      reason: explain(head, ranked, chosen),
    }));

    head = chosen.cylinder;
    pending = pendingAfter;
  }
  return buildExecution('SSTF', input, steps);
}
