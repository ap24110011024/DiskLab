/*
 * Standard playback controls (Play/Pause/Resume, Previous, Next, Reset,
 * Replay, speed slider and progress slider) plus keyboard shortcuts.
 * `player` is anything with toggle/next/previous/reset/replay/goTo/setSpeed;
 * the arena passes an object that controls three lanes at once.
 */

import { isTyping } from '../ui.js';

export function createPlaybackBar(container, player, { total, keyboard = true } = {}) {
  container.innerHTML = `
    <div class="playback" role="group" aria-label="Simulation controls">
      <div class="button-row">
        <button class="btn" data-act="reset" title="Reset (R)">Reset</button>
        <button class="btn" data-act="previous" title="Previous step (Left arrow)">◀ Previous</button>
        <button class="btn btn-primary play-btn" data-act="toggle" title="Play / Pause (Space)">Play</button>
        <button class="btn" data-act="next" title="Next step (Right arrow)">Next ▶</button>
        <button class="btn" data-act="replay">Replay</button>
      </div>
      <label class="slider-field">
        <span>Speed</span>
        <input class="range" type="range" min="0.25" max="3" step="0.25" value="1" data-role="speed">
        <output class="mono" data-role="speed-out">1×</output>
      </label>
      <label class="slider-field grow">
        <span>Step</span>
        <input class="range" type="range" min="0" max="${total}" step="1" value="0" data-role="progress">
        <output class="mono" data-role="progress-out">0 / ${total}</output>
      </label>
    </div>`;

  const toggle = container.querySelector('[data-act="toggle"]');
  const speed = container.querySelector('[data-role="speed"]');
  const speedOut = container.querySelector('[data-role="speed-out"]');
  const progress = container.querySelector('[data-role="progress"]');
  const progressOut = container.querySelector('[data-role="progress-out"]');

  container.addEventListener('click', (event) => {
    const act = event.target.closest('[data-act]')?.dataset.act;
    if (act && typeof player[act] === 'function') player[act]();
  });
  speed.addEventListener('input', () => {
    speedOut.textContent = `${speed.value}×`;
    player.setSpeed(Number(speed.value));
  });
  progress.addEventListener('input', () => player.goTo(Number(progress.value)));

  function onKey(event) {
    const target = event.target instanceof Element ? event.target : document.body;
    if (isTyping(event) || target.closest('.platter-stage')) return;
    if (event.key === ' ' && !target.closest('button')) { event.preventDefault(); player.toggle(); }
    else if (event.key === 'ArrowRight') { event.preventDefault(); player.next(); }
    else if (event.key === 'ArrowLeft') { event.preventDefault(); player.previous(); }
    else if (event.key === 'r' || event.key === 'R') player.reset();
  }
  if (keyboard) document.addEventListener('keydown', onKey);

  return {
    /** state = { playing, finished, step, total } */
    update({ playing, finished, step, total: count }) {
      toggle.textContent = playing ? 'Pause' : (step > 0 && !finished ? 'Resume' : 'Play');
      progress.max = count;
      progress.value = step;
      progressOut.textContent = `${step} / ${count}`;
      container.querySelector('[data-act="previous"]').disabled = step === 0 && !playing;
      container.querySelector('[data-act="next"]').disabled = finished;
    },
    destroy() { document.removeEventListener('keydown', onKey); },
  };
}
