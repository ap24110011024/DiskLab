/*
 * Runs algorithms on a workload. Every algorithm receives its own frozen
 * copy of the same input, so the three results are independent of each other.
 */

import { runAlgorithm, ALGORITHMS } from '../algorithms/index.js';

export function toAlgorithmInput(workload) {
  return Object.freeze({
    diskSize: workload.diskSize,
    initialHead: workload.initialHead,
    direction: workload.direction,
    requests: Object.freeze(workload.requests.map((r) => Object.freeze({ id: r.id, cylinder: r.cylinder }))),
  });
}

export function runOne(name, workload) {
  return runAlgorithm(name, toAlgorithmInput(workload));
}

export function runAll(workload) {
  const results = {};
  for (const name of ALGORITHMS) results[name] = runAlgorithm(name, toAlgorithmInput(workload));
  return results;
}
