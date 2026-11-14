/*
 * LOOK - like SCAN, but the head reverses at the LAST PENDING REQUEST in its
 * direction instead of travelling to the physical boundary. If nothing lies in
 * the initial direction, it starts by serving the other side.
 */

import { prepareInput, removeById, requestsAhead, opposite, listText, makeStep, buildExecution } from './common.js';

export function runLOOK(rawInput) {
  const input = prepareInput(rawInput);
  const lastCylinder = input.diskSize - 1;
  let head = input.initialHead;
  let sweep = input.direction;
  let pending = [...input.requests];
  const steps = [];

  function service(request, note) {
    const pendingAfter = removeById(pending, request.id);
    const remainingAhead = requestsAhead(pendingAfter, request.cylinder, sweep);
    const turnsHere = pendingAfter.length > 0 && remainingAhead.length === 0;

    let reason = request.cylinder === head
      ? `A pending request is at the current head position (${head}); LOOK services it with zero movement.`
      : `${note}The head is at ${head}, sweeping ${sweep}. Cylinder ${request.cylinder} is the next pending request `
        + `in that direction (${Math.abs(request.cylinder - head)} cylinders away).`;
    if (turnsHere) {
      const boundary = sweep === 'RIGHT' ? lastCylinder : 0;
      reason += ` It is the last pending request to the ${sweep}, so LOOK reverses here`
        + (request.cylinder === boundary ? '.' : ` instead of going on to cylinder ${boundary}, saving ${Math.abs(boundary - request.cylinder)} cylinders of travel.`);
    }

    steps.push(makeStep({
      type: 'SERVICE', from: head, to: request.cylinder, sweep, request,
      pendingBefore: pending, pendingAfter,
      candidates: requestsAhead(pending, head, sweep).map((r) => ({ id: r.id, cylinder: r.cylinder, distance: Math.abs(r.cylinder - head) })),
      title: turnsHere ? `Last request ${sweep}: ${request.cylinder}, reverse` : `Sweep ${sweep}: service ${request.cylinder}`,
      reason,
      reverseAfter: turnsHere,
    }));
    head = request.cylinder;
    pending = pendingAfter;
  }

  const firstSweep = requestsAhead(pending, head, sweep);
  for (const request of firstSweep) service(request, '');

  let reversedAtStart = false;
  if (pending.length > 0) {
    let note = '';
    if (firstSweep.length === 0) {
      reversedAtStart = true;
      note = `Nothing is pending to the ${sweep} of the head, so LOOK does not move that way; `
        + `it serves ${listText([...pending].sort((a, b) => a.cylinder - b.cylinder))} on the other side. `;
    }
    sweep = opposite(sweep);
    let first = true;
    for (const request of requestsAhead(pending, head, sweep)) {
      service(request, first ? note : '');
      first = false;
    }
  }
  return buildExecution('LOOK', input, steps, reversedAtStart);
}
