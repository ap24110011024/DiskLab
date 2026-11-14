/*
 * Helpers that READ an execution result. The visualisations and panels use
 * these so that everything on screen comes from the algorithm's own steps.
 *
 * "step" = number of finished movements (0 .. steps.length)
 * "progress" = how far the next movement has gone (0 .. 1)
 */

// Each movement is shown in three phases:
//   decide (0 - 0.4): the algorithm's choice is shown, head waits
//   move   (0.4 - 0.88): the head travels
//   settle (0.88 - 1): the request turns green / boundary or reversal is shown
export const PHASES = { decideEnd: 0.4, moveEnd: 0.88 };

export function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
}

export function phaseOf(progress) {
  if (progress <= 0) return { name: 'idle', moveFraction: 0 };
  if (progress < PHASES.decideEnd) return { name: 'decide', moveFraction: 0 };
  if (progress < PHASES.moveEnd) {
    const t = (progress - PHASES.decideEnd) / (PHASES.moveEnd - PHASES.decideEnd);
    return { name: 'move', moveFraction: easeInOut(t) };
  }
  return { name: 'settle', moveFraction: 1 };
}

/** Head position (may be fractional while moving). */
export function headPositionAt(result, step, progress) {
  if (step >= result.steps.length || progress <= 0) return result.path[Math.min(step, result.path.length - 1)];
  const current = result.steps[step];
  return current.from + (current.to - current.from) * phaseOf(progress).moveFraction;
}

/** The movement being shown: the one in progress, or the one just finished. */
export function activeStep(result, step, progress) {
  if (progress > 0 && step < result.steps.length) return result.steps[step];
  return step > 0 ? result.steps[step - 1] : null;
}

/** Set of request ids already serviced (counts the current one once it settles). */
export function servicedIds(result, step, progress) {
  const done = new Set();
  for (let i = 0; i < step && i < result.steps.length; i++) {
    if (result.steps[i].request) done.add(result.steps[i].request.id);
  }
  const current = result.steps[step];
  if (current && current.request && phaseOf(progress).name === 'settle') done.add(current.request.id);
  return done;
}

/** Movement so far, including the part of the current move already travelled. */
export function movementSoFar(result, step, progress) {
  const finished = step > 0 ? result.steps[Math.min(step, result.steps.length) - 1].cumulative : 0;
  if (step >= result.steps.length || progress <= 0) return finished;
  return finished + result.steps[step].distance * phaseOf(progress).moveFraction;
}

/** Direction the head is sweeping / moving at this moment, for the arrow. */
export function directionAt(result, step, progress) {
  const current = activeStep(result, step, progress);
  if (!current) return result.algorithm === 'SSTF' ? null : result.direction;
  if (current.direction !== 'NONE') return current.direction;
  return current.sweep;
}
