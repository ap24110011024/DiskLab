/*
 * The "current workload" shared by all pages. The Input Studio edits it; the
 * simulator, arena, step explorer, analytics and SCAN vs LOOK pages read it.
 *
 * workload = { diskSize, initialHead, direction, requests: [{ id, cylinder }] }
 * Every request has a unique id even when two cylinders are equal.
 */

import { loadCurrentWorkload, saveCurrentWorkload } from './storage.js';
import { validateWorkload } from './validation.js';

export const SAMPLE_WORKLOAD = {
  diskSize: 200,
  initialHead: 50,
  direction: 'RIGHT',
  requests: [82, 43, 170, 16].map((cylinder, i) => ({ id: `r${i + 1}`, cylinder })),
};

/** Gives a list of cylinders fresh ids r1, r2, ... */
export function withIds(cylinders) {
  return cylinders.map((cylinder, i) => ({ id: `r${i + 1}`, cylinder }));
}

/** Next unused id for a request added to an existing list. */
export function nextRequestId(requests) {
  let max = 0;
  for (const r of requests) {
    const n = Number(String(r.id).replace(/\D/g, ''));
    if (n > max) max = n;
  }
  return `r${max + 1}`;
}

export function copyWorkload(workload) {
  return {
    diskSize: workload.diskSize,
    initialHead: workload.initialHead,
    direction: workload.direction,
    requests: workload.requests.map((r) => ({ id: r.id, cylinder: r.cylinder })),
  };
}

/** The saved workload if it is valid, otherwise the sample. */
export function getWorkload() {
  const saved = loadCurrentWorkload().value;
  if (saved && validateWorkload(saved).isValid) return copyWorkload(saved);
  return copyWorkload(SAMPLE_WORKLOAD);
}

export function setWorkload(workload) {
  return saveCurrentWorkload(copyWorkload(workload));
}
