/*
 * Helpers shared by sstf.js, scan.js and look.js, plus buildExecution(),
 * which turns the recorded steps into the common execution result.
 */

import { checkAlgorithmInput } from '../validation.js';
import { totalMovement, averageMovement, countDirectionChanges, moveDirection } from '../analytics/metrics.js';

/**
 * Accepts [82, 43] or [{ id, cylinder }] and returns
 * [{ id, cylinder, order }]. `order` is the position in the original queue,
 * used to keep ties deterministic.
 */
export function prepareInput(input) {
  checkAlgorithmInput(input);
  const requests = input.requests.map((request, index) => (typeof request === 'number'
    ? { id: `r${index + 1}`, cylinder: request, order: index }
    : { id: request.id ?? `r${index + 1}`, cylinder: request.cylinder, order: index }));
  return { ...input, requests };
}

export function removeById(list, id) {
  return list.filter((request) => request.id !== id);
}

/**
 * Pending requests the head will meet when moving in `direction`, in the order
 * it meets them. A request exactly at the head counts as "ahead".
 * Equal cylinders keep their original queue order.
 */
export function requestsAhead(pending, head, direction) {
  if (direction === 'RIGHT') {
    return pending.filter((r) => r.cylinder >= head)
      .sort((a, b) => a.cylinder - b.cylinder || a.order - b.order);
  }
  return pending.filter((r) => r.cylinder <= head)
    .sort((a, b) => b.cylinder - a.cylinder || a.order - b.order);
}

export function opposite(direction) {
  return direction === 'RIGHT' ? 'LEFT' : 'RIGHT';
}

export function listText(requests, limit = 8) {
  const values = requests.map((r) => r.cylinder);
  if (values.length === 0) return 'none';
  const shown = values.slice(0, limit).join(', ');
  return values.length > limit ? `${shown} and ${values.length - limit} more` : shown;
}

const clean = (r) => ({ id: r.id, cylinder: r.cylinder });

/** One step record. Every algorithm creates steps with this function. */
export function makeStep({ type, from, to, sweep, request = null, pendingBefore, pendingAfter, candidates = [], title, reason, reverseAfter = false }) {
  return {
    type,                       // 'SERVICE' or 'BOUNDARY'
    from,
    to,
    distance: Math.abs(to - from),
    direction: moveDirection(from, to),  // actual movement: LEFT, RIGHT or NONE
    sweep,                      // direction the algorithm is sweeping in (SSTF: null)
    request: request ? clean(request) : null,
    pendingBefore: pendingBefore.map(clean),
    pendingAfter: pendingAfter.map(clean),
    candidates,                 // SSTF: every pending request with its distance
    title,                      // short decision, e.g. "Service cylinder 43"
    reason,                     // full explanation shown in the learning panels
    reverseAfter,               // true when the head turns around after this step
  };
}

/** Builds the execution result used by every page (animation, charts, export, history). */
export function buildExecution(name, input, steps, initialReversal = false) {
  let cumulative = 0;
  steps.forEach((step, index) => {
    step.number = index + 1;
    cumulative += step.distance;
    step.cumulative = cumulative;
  });

  const path = [input.initialHead, ...steps.map((s) => s.to)];
  const services = steps.filter((s) => s.type === 'SERVICE');
  const total = totalMovement(path);

  const boundaryEvents = steps.filter((s) => s.type === 'BOUNDARY').map((s) => ({ step: s.number, cylinder: s.to }));
  const reversalEvents = [];
  if (initialReversal) {
    reversalEvents.push({ step: 0, cylinder: input.initialHead, from: input.direction, to: opposite(input.direction) });
  }
  if (name === 'SSTF') {
    // SSTF has no sweep; record a reversal wherever the movement direction flips.
    let previous = null;
    let previousStep = 0;
    for (const step of steps) {
      if (step.direction === 'NONE') continue;
      if (previous && step.direction !== previous) {
        reversalEvents.push({ step: previousStep, cylinder: step.from, from: previous, to: step.direction });
      }
      previous = step.direction;
      previousStep = step.number;
    }
  }
  for (const step of steps) {
    if (step.reverseAfter) {
      reversalEvents.push({ step: step.number, cylinder: step.to, from: step.sweep, to: opposite(step.sweep) });
    }
  }

  return {
    algorithm: name,
    diskSize: input.diskSize,
    initialHead: input.initialHead,
    direction: input.direction,
    requests: input.requests.map(clean),
    serviceSequence: services.map((s) => s.request),
    serviceOrder: services.map((s) => s.to),
    path,
    distances: steps.map((s) => s.distance),
    steps,
    totalMovement: total,
    averageMovement: averageMovement(total, services.length),
    servicedCount: services.length,
    directionChanges: countDirectionChanges(path),
    finalHead: path[path.length - 1],
    boundaryEvents,
    reversalEvents,
  };
}
