/*
 * Keeps track of WHERE the simulation is: step and progress. It has no timer;
 * animation-controller.js moves the progress forward. Every change calls
 * onChange(step, progress) so the page can redraw.
 */

export function createStepController(totalSteps, onChange) {
  let step = 0;
  let progress = 0;

  function notify() {
    onChange(step, progress);
  }

  return {
    get step() { return step; },
    get progress() { return progress; },
    get total() { return totalSteps; },
    isFinished() { return step >= totalSteps; },

    /** Moves the current step forward by `amount` (0..1). Returns true if a step finished. */
    advance(amount) {
      if (step >= totalSteps) return false;
      progress += amount;
      if (progress >= 1) {
        step += 1;
        progress = 0;
        notify();
        return true;
      }
      notify();
      return false;
    },
    goTo(target) {
      step = Math.max(0, Math.min(totalSteps, target));
      progress = 0;
      notify();
    },
    next() { this.goTo(step + 1); },
    previous() {
      if (progress > 0) this.goTo(step); // back to the start of the current move
      else this.goTo(step - 1);
    },
    reset() { this.goTo(0); },
    refresh: notify,
  };
}
