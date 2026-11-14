/*
 * The playback timer. It uses requestAnimationFrame to push the step
 * controller forward. Speed only changes how fast time passes; it never
 * changes the algorithm result.
 *
 * Duration of one movement = base time + extra time proportional to the
 * distance, so long seeks visibly take longer than short ones.
 */

const BASE_MS = 900;
const FULL_DISK_MS = 1600;
const SSTF_DECIDE_MS = 700; // extra time so the distance arcs can be read

export function createAnimationController(stepController, { result, onStateChange, reducedMotion = false }) {
  let playing = false;
  let stopAfterStep = false;
  let speed = 1;
  let frameId = null;
  let lastTime = null;
  let waited = 0; // used only in reduced-motion mode

  function durationOf(index) {
    const step = result.steps[index];
    if (!step) return BASE_MS;
    let ms = BASE_MS + FULL_DISK_MS * (step.distance / Math.max(1, result.diskSize - 1));
    if (step.type === 'BOUNDARY' || step.reverseAfter) ms += 400; // short pause at a turn
    if (result.algorithm === 'SSTF' && step.distance > 0) ms += SSTF_DECIDE_MS;
    return ms / speed;
  }

  function emit() {
    onStateChange({ playing, finished: stepController.isFinished(), step: stepController.step, total: stepController.total });
  }

  function stop() {
    playing = false;
    stopAfterStep = false;
    if (frameId !== null) cancelAnimationFrame(frameId);
    frameId = null;
    lastTime = null;
  }

  function tick(time) {
    if (lastTime === null) lastTime = time;
    const elapsed = time - lastTime;
    lastTime = time;

    // Reduced motion: no in-between frames, the head jumps once per step.
    const amount = reducedMotion ? 0 : elapsed / durationOf(stepController.step);
    let finishedStep;
    if (reducedMotion) {
      waited += elapsed;
      finishedStep = waited >= durationOf(stepController.step) ? stepController.advance(1) : false;
      if (finishedStep) waited = 0;
    } else {
      finishedStep = stepController.advance(amount);
    }

    if (stepController.isFinished() || (finishedStep && stopAfterStep)) {
      stop();
      emit();
      return;
    }
    frameId = requestAnimationFrame(tick);
  }

  function start(single) {
    if (stepController.isFinished()) return;
    playing = true;
    stopAfterStep = single;
    lastTime = null;
    waited = 0;
    if (frameId === null) frameId = requestAnimationFrame(tick);
    emit();
  }

  return {
    get playing() { return playing; },
    play() {
      if (stepController.isFinished()) stepController.reset();
      start(false);
    },
    pause() { stop(); emit(); },
    toggle() { if (playing) this.pause(); else this.play(); },
    /** Animate exactly one movement (or finish the current one instantly while playing). */
    next() {
      if (playing && !stopAfterStep) { stop(); stepController.next(); emit(); return; }
      if (reducedMotion) { stop(); stepController.next(); emit(); return; }
      start(true);
    },
    previous() { stop(); stepController.previous(); emit(); },
    reset() { stop(); stepController.reset(); emit(); },
    replay() { stop(); stepController.reset(); start(false); },
    goTo(step) { stop(); stepController.goTo(step); emit(); },
    setSpeed(value) { speed = value; },
    destroy() { stop(); },
    emit,
  };
}
