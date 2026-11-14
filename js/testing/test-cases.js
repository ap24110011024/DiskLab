/*
 * Test cases for SSTF, SCAN and LOOK. They are used by BOTH the in-browser
 * Testing Playground (pages/testing.html) and the command-line runner
 * (tests/run-tests.mjs), so there is one source of truth.
 *
 * Each case: { name, input, expect: { SSTF?, SCAN?, LOOK? } }
 * where an expectation can give path, total, serviceOrder, finalHead.
 * Every case is also checked against the general rules in checkInvariants().
 */

const disk200 = (initialHead, requests, direction = 'RIGHT') => ({ diskSize: 200, initialHead, requests, direction });

export const TEST_CASES = [
  {
    name: 'Specification example (head 50, RIGHT)',
    input: disk200(50, [82, 43, 170, 16]),
    expect: {
      SSTF: { path: [50, 43, 16, 82, 170], total: 188 },
      SCAN: { path: [50, 82, 170, 199, 43, 16], total: 332, finalHead: 16 },
      LOOK: { path: [50, 82, 170, 43, 16], total: 274, finalHead: 16 },
    },
  },
  {
    name: 'Empty request queue',
    input: disk200(50, []),
    expect: { SSTF: { path: [50], total: 0 }, SCAN: { path: [50], total: 0 }, LOOK: { path: [50], total: 0 } },
  },
  {
    name: 'Single request',
    input: disk200(50, [120]),
    expect: { SSTF: { path: [50, 120], total: 70 }, SCAN: { path: [50, 120], total: 70 }, LOOK: { path: [50, 120], total: 70 } },
  },
  {
    name: 'Duplicate requests are each serviced',
    input: disk200(50, [70, 70, 30], 'LEFT'),
    expect: {
      SSTF: { serviceOrder: [30, 70, 70], total: 60 },
      SCAN: { path: [50, 30, 0, 70, 70], total: 120 },
      LOOK: { path: [50, 30, 70, 70], total: 60 },
    },
  },
  {
    name: 'Request equal to the initial head',
    input: disk200(50, [90, 50, 10]),
    expect: {
      SSTF: { path: [50, 50, 10, 90], total: 120 },
      SCAN: { path: [50, 50, 90, 199, 10], total: 338 },
      LOOK: { path: [50, 50, 90, 10], total: 120 },
    },
  },
  {
    name: 'All requests on the left (moving RIGHT)',
    input: disk200(120, [95, 60, 30, 10]),
    expect: {
      SSTF: { path: [120, 95, 60, 30, 10], total: 110 },
      SCAN: { path: [120, 199, 95, 60, 30, 10], total: 268 },
      LOOK: { path: [120, 95, 60, 30, 10], total: 110 },
    },
  },
  {
    name: 'All requests on the right (moving RIGHT)',
    input: disk200(10, [150, 20, 90]),
    expect: {
      SSTF: { path: [10, 20, 90, 150], total: 140 },
      SCAN: { path: [10, 20, 90, 150], total: 140 },
      LOOK: { path: [10, 20, 90, 150], total: 140 },
    },
  },
  {
    name: 'Requests on both sides (LEFT)',
    input: disk200(50, [82, 43, 170, 16], 'LEFT'),
    expect: {
      SCAN: { path: [50, 43, 16, 0, 82, 170], total: 220 },
      LOOK: { path: [50, 43, 16, 82, 170], total: 188 },
    },
  },
  {
    name: 'Request at cylinder 0',
    input: disk200(40, [0, 100], 'LEFT'),
    expect: {
      SCAN: { path: [40, 0, 100], total: 140 },
      LOOK: { path: [40, 0, 100], total: 140 },
      SSTF: { path: [40, 0, 100], total: 140 },
    },
  },
  {
    name: 'Request at the maximum cylinder',
    input: disk200(150, [199, 20]),
    expect: {
      SCAN: { path: [150, 199, 20], total: 228 },
      LOOK: { path: [150, 199, 20], total: 228 },
      SSTF: { path: [150, 199, 20], total: 228 },
    },
  },
  {
    name: 'Equal-distance SSTF tie picks the lower cylinder',
    input: disk200(50, [60, 40]),
    expect: { SSTF: { path: [50, 40, 60], total: 30 } },
  },
  {
    name: 'Small disk (5 cylinders)',
    input: { diskSize: 5, initialHead: 2, requests: [4, 0, 3], direction: 'LEFT' },
    expect: {
      SSTF: { path: [2, 3, 4, 0], total: 6 },
      SCAN: { path: [2, 0, 3, 4], total: 6 },
      LOOK: { path: [2, 0, 3, 4], total: 6 },
    },
  },
  {
    name: 'Large disk (5000 cylinders)',
    input: { diskSize: 5000, initialHead: 2500, requests: [4999, 10, 2600, 1200], direction: 'RIGHT' },
    expect: {
      SCAN: { path: [2500, 2600, 4999, 1200, 10], total: 7488 },
      LOOK: { path: [2500, 2600, 4999, 1200, 10], total: 7488 },
      SSTF: { path: [2500, 2600, 1200, 10, 4999], total: 7679 },
    },
  },
  {
    name: 'LEFT initial direction (textbook queue, head 53)',
    input: disk200(53, [98, 183, 37, 122, 14, 124, 65, 67], 'LEFT'),
    expect: {
      SSTF: { serviceOrder: [65, 67, 37, 14, 98, 122, 124, 183], total: 236 },
      SCAN: { path: [53, 37, 14, 0, 65, 67, 98, 122, 124, 183], total: 236 },
      LOOK: { path: [53, 37, 14, 65, 67, 98, 122, 124, 183], total: 208 },
    },
  },
  {
    name: 'RIGHT initial direction (textbook queue, head 53)',
    input: disk200(53, [98, 183, 37, 122, 14, 124, 65, 67], 'RIGHT'),
    expect: {
      SCAN: { path: [53, 65, 67, 98, 122, 124, 183, 199, 37, 14], total: 331 },
      LOOK: { path: [53, 65, 67, 98, 122, 124, 183, 37, 14], total: 299 },
    },
  },
];

/**
 * Rules that must hold for EVERY result. Returns a list of problems (empty = OK).
 */
export function checkInvariants(name, input, result) {
  const problems = [];
  const ids = result.serviceSequence.map((r) => r.id);
  if (new Set(ids).size !== ids.length) problems.push('a request was serviced twice');
  if (ids.length !== input.requests.length) problems.push(`serviced ${ids.length} of ${input.requests.length} requests`);
  if (result.path.some((c) => !Number.isInteger(c) || c < 0 || c > input.diskSize - 1)) problems.push('visited an invalid cylinder');

  const sum = result.steps.reduce((total, step) => total + step.distance, 0);
  if (sum !== result.totalMovement) problems.push('total movement does not equal the sum of the steps');
  if (result.finalHead !== result.path[result.path.length - 1]) problems.push('final head is wrong');

  if (name === 'SSTF') {
    for (const step of result.steps) {
      const nearest = Math.min(...step.pendingBefore.map((r) => Math.abs(r.cylinder - step.from)));
      if (step.distance !== nearest) problems.push(`step ${step.number} did not choose the nearest request`);
    }
  }
  if (name === 'SCAN' || name === 'LOOK') {
    if (result.directionChanges > 1) problems.push('reversed more than once');
  }
  if (name === 'SCAN') {
    // If the head reversed after moving, it must have reached the boundary first.
    const reversals = result.reversalEvents.filter((e) => e.step > 0);
    for (const event of reversals) {
      if (event.cylinder !== 0 && event.cylinder !== input.diskSize - 1) problems.push('SCAN reversed before reaching the boundary');
    }
  }
  if (name === 'LOOK') {
    if (result.boundaryEvents.length > 0) problems.push('LOOK made a boundary trip');
    for (const event of result.reversalEvents.filter((e) => e.step > 0)) {
      const step = result.steps[event.step - 1];
      if (!step.request) problems.push('LOOK reversed somewhere other than a request');
    }
  }
  return problems;
}
