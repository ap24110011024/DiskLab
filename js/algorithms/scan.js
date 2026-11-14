/*
 * SCAN - the elevator algorithm.
 *  1. Sweep in the initial direction, servicing requests on the way.
 *  2. If requests are still waiting on the other side, keep going to the
 *     physical boundary (0 or diskSize - 1), then reverse.
 *  3. Sweep back and service the rest.
 * The boundary trip counts as movement but is not a serviced request.
 * There is no boundary trip or reversal once every request is serviced.
 */

import { prepareInput, removeById, requestsAhead, opposite, listText, makeStep, buildExecution } from './common.js';

export function runSCAN(rawInput) {
  const input = prepareInput(rawInput);
  const lastCylinder = input.diskSize - 1;
  let head = input.initialHead;
  let sweep = input.direction;
  let pending = [...input.requests];
  const steps = [];
  let reversedAtStart = false;

  function service(request, note) {
    const pendingAfter = removeById(pending, request.id);
    const reason = request.cylinder === head
      ? `A pending request is at the current head position (${head}); SCAN services it with zero movement.`
      : `${note}The head is at ${head}, sweeping ${sweep}. Cylinder ${request.cylinder} is the next pending request `
        + `in that direction (${Math.abs(request.cylinder - head)} cylinders away).`;
    steps.push(makeStep({
      type: 'SERVICE', from: head, to: request.cylinder, sweep, request,
      pendingBefore: pending, pendingAfter,
      candidates: requestsAhead(pending, head, sweep).map((r) => ({ id: r.id, cylinder: r.cylinder, distance: Math.abs(r.cylinder - head) })),
      title: `Sweep ${sweep}: service ${request.cylinder}`,
      reason,
    }));
    head = request.cylinder;
    pending = pendingAfter;
  }

  // 1. First sweep
  for (const request of requestsAhead(pending, head, sweep)) service(request, '');

  // 2. Boundary trip and reversal, only if work remains
  if (pending.length > 0) {
    const boundary = sweep === 'RIGHT' ? lastCylinder : 0;
    if (head !== boundary) {
      steps.push(makeStep({
        type: 'BOUNDARY', from: head, to: boundary, sweep,
        pendingBefore: pending, pendingAfter: pending,
        title: `Travel to boundary ${boundary}`,
        reason: `No pending requests remain to the ${sweep} of ${head}, but ${listText([...pending].sort((a, b) => a.cylinder - b.cylinder))} `
          + `still wait on the other side. SCAN keeps moving ${sweep} to the physical boundary at cylinder ${boundary} `
          + `(${Math.abs(boundary - head)} cylinders) and reverses there. The boundary is movement only, not a serviced request.`,
        reverseAfter: true,
      }));
      head = boundary;
    } else if (steps.length > 0) {
      steps[steps.length - 1].reverseAfter = true; // last request sat on the boundary
    } else {
      reversedAtStart = true; // head started on the boundary
    }

    const reversedAt = head;
    sweep = opposite(sweep);
    let first = true;
    for (const request of requestsAhead(pending, head, sweep)) {
      service(request, first ? `The head reversed at cylinder ${reversedAt}. ` : '');
      first = false;
    }
  }
  return buildExecution('SCAN', input, steps, reversedAtStart);
}
