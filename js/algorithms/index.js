/* Maps algorithm names to functions so pages can call runAlgorithm('SCAN', input). */

import { runSSTF } from './sstf.js';
import { runSCAN } from './scan.js';
import { runLOOK } from './look.js';

export const ALGORITHMS = ['SSTF', 'SCAN', 'LOOK'];

export const ALGORITHM_INFO = {
  SSTF: { name: 'Shortest Seek Time First', short: 'Always goes to the nearest pending request.', color: '#557C78' },
  SCAN: { name: 'SCAN (Elevator)', short: 'Sweeps to the disk edge, then reverses.', color: '#B86F52' },
  LOOK: { name: 'LOOK', short: 'Sweeps like SCAN but turns at the last request.', color: '#718096' },
};

const RUNNERS = { SSTF: runSSTF, SCAN: runSCAN, LOOK: runLOOK };

export function runAlgorithm(name, input) {
  if (!RUNNERS[name]) throw new Error(`Unknown algorithm: ${name}`);
  return RUNNERS[name](input);
}
