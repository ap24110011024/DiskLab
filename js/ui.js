/*
 * Small UI helpers used on many pages: escaping, toasts, a confirmation
 * dialog, a details dialog and animated number counters.
 */

export function escapeHtml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

export function formatNumber(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return '-';
  return Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 });
}

export function formatDate(iso) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export function prefersReducedMotion() {
  return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** true when the user is typing, so keyboard shortcuts must not fire. */
export function isTyping(event) {
  const target = event.target instanceof Element ? event.target : null;
  return Boolean(target && target.closest('input, textarea, select, [contenteditable="true"]'));
}

export function toast(message, type = 'info') {
  let region = document.getElementById('toast-region');
  if (!region) {
    region = document.createElement('div');
    region.id = 'toast-region';
    region.className = 'toast-region';
    region.setAttribute('aria-live', 'polite');
    document.body.appendChild(region);
  }
  const item = document.createElement('div');
  item.className = `toast toast-${type}`;
  item.textContent = message;
  region.appendChild(item);
  setTimeout(() => item.classList.add('leaving'), 3800);
  setTimeout(() => item.remove(), 4200);
}

let dialogCount = 0;

function openDialog(html, wide) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `<div class="modal${wide ? ' modal-wide' : ''}" role="dialog" aria-modal="true">${html}</div>`;
  document.body.appendChild(backdrop);

  // Name the dialog after its first heading for screen readers.
  const modal = backdrop.querySelector('.modal');
  const heading = modal.querySelector('h2');
  if (heading) {
    dialogCount += 1;
    heading.id = `dialog-title-${dialogCount}`;
    modal.setAttribute('aria-labelledby', heading.id);
  }

  // Keep keyboard focus inside the dialog: Tab from the last control returns to the first.
  modal.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;
    const focusable = [...modal.querySelectorAll('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])')];
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  return backdrop;
}

export function confirmDialog({ title, message, confirmText = 'Confirm' }) {
  const returnFocus = document.activeElement;
  return new Promise((resolve) => {
    const backdrop = openDialog(`
      <h2>${escapeHtml(title)}</h2><p>${escapeHtml(message)}</p>
      <div class="button-row end">
        <button class="btn" data-answer="no">Cancel</button>
        <button class="btn btn-danger" data-answer="yes">${escapeHtml(confirmText)}</button>
      </div>`, false);
    const close = (answer) => {
      document.removeEventListener('keydown', onKey);
      backdrop.classList.add('closing');
      setTimeout(() => backdrop.remove(), 150);
      if (returnFocus) returnFocus.focus();
      resolve(answer);
    };
    const onKey = (e) => { if (e.key === 'Escape') close(false); };
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) close(false);
      const answer = e.target.closest('[data-answer]')?.dataset.answer;
      if (answer) close(answer === 'yes');
    });
    document.addEventListener('keydown', onKey);
    backdrop.querySelector('[data-answer="no"]').focus();
  });
}

/** Shows trusted HTML (callers escape their data). Returns the dialog element. */
export function showDialog(html) {
  const returnFocus = document.activeElement;
  const backdrop = openDialog(`${html}<div class="button-row end"><button class="btn" data-close>Close</button></div>`, true);
  const close = () => {
    document.removeEventListener('keydown', onKey);
    backdrop.remove();
    if (returnFocus) returnFocus.focus();
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop || e.target.closest('[data-close]')) close(); });
  document.addEventListener('keydown', onKey);
  backdrop.querySelector('[data-close]').focus();
  return backdrop.querySelector('.modal');
}

/** Counts a number up to `target` (skipped with reduced motion). */
export function animateNumber(element, target, duration = 600) {
  const start = Number(element.dataset.value || 0);
  element.dataset.value = target;
  if (prefersReducedMotion() || start === target) {
    element.textContent = formatNumber(target);
    return;
  }
  const startTime = performance.now();
  function frame(now) {
    const t = Math.min(1, (now - startTime) / duration);
    element.textContent = formatNumber(Math.round(start + (target - start) * t));
    if (t < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
