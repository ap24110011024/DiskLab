/*
 * Request queue editor for the Input Studio. Shows one chip per request
 * (with its unique id), lets the user edit a chip by clicking it, remove it,
 * add one or many requests, and clear everything.
 */

import { escapeHtml } from '../ui.js';
import { validateCylinder } from '../validation.js';

export function renderQueue(container, requests, { onRemove, onEdit, highlightId = null }) {
  if (requests.length === 0) {
    container.innerHTML = '<span class="faint small">No requests yet. Type cylinders above, click the track, or pick a preset.</span>';
    return;
  }
  container.innerHTML = requests.map((r) => `
    <span class="chip${r.id === highlightId ? ' current' : ''}" data-id="${r.id}">
      <button class="chip-value" type="button" data-edit="${r.id}" title="Edit">${r.cylinder}</button>
      <span class="chip-id">${escapeHtml(r.id)}</span>
      <button type="button" data-remove="${r.id}" aria-label="Remove request ${r.cylinder}">×</button>
    </span>`).join('');

  container.onclick = (event) => {
    const remove = event.target.closest('[data-remove]');
    const edit = event.target.closest('[data-edit]');
    if (remove) onRemove(remove.dataset.remove);
    if (edit) startEditing(edit, onEdit);
  };
}

/** Replaces a chip value with a small input; Enter saves, Escape cancels. */
function startEditing(button, onEdit) {
  const id = button.dataset.edit;
  const input = document.createElement('input');
  input.value = button.textContent;
  input.setAttribute('aria-label', 'New cylinder');
  button.replaceWith(input);
  input.focus();
  input.select();
  let done = false;
  const finish = (save) => {
    if (done) return;
    done = true;
    onEdit(id, save ? input.value : null);
  };
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') finish(true);
    if (event.key === 'Escape') finish(false);
  });
  input.addEventListener('blur', () => finish(true));
}

export { validateCylinder };
