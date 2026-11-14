/*
 * Start-up code shared by every page: navigation and the page fade-in.
 * Each page script calls initPage('<key>') first.
 */

import { renderNavigation } from './navigation.js';
import { prefersReducedMotion } from './ui.js';

export function initPage(key) {
  renderNavigation(key);
  if (prefersReducedMotion()) document.documentElement.classList.add('reduce-motion');
  requestAnimationFrame(() => document.body.classList.add('ready'));
}
