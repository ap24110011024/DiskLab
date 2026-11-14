/*
 * Runs TEST_CASES against the real algorithms and returns rows with the
 * expected value, the actual value and PASS/FAIL. Used by the Testing
 * Playground page and by tests/run-tests.mjs.
 */

import { runAlgorithm, ALGORITHMS } from '../algorithms/index.js';
import { TEST_CASES, checkInvariants } from './test-cases.js';
import { seededRandom } from '../input/workload-generator.js';

function same(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function runTestCases() {
  const rows = [];
  for (const testCase of TEST_CASES) {
    for (const name of ALGORITHMS) {
      const expectation = testCase.expect[name];
      let result;
      try {
        result = runAlgorithm(name, testCase.input);
      } catch (error) {
        rows.push({ test: testCase.name, algorithm: name, expected: 'no error', actual: error.message, pass: false });
        continue;
      }
      const problems = checkInvariants(name, testCase.input, result);
      const expectedParts = [];
      const actualParts = [];

      if (expectation) {
        if (expectation.path) {
          expectedParts.push(`path ${expectation.path.join('→')}`);
          actualParts.push(`path ${result.path.join('→')}`);
          if (!same(expectation.path, result.path)) problems.push('path differs');
        }
        if (expectation.serviceOrder) {
          expectedParts.push(`order ${expectation.serviceOrder.join(', ')}`);
          actualParts.push(`order ${result.serviceOrder.join(', ')}`);
          if (!same(expectation.serviceOrder, result.serviceOrder)) problems.push('service order differs');
        }
        if (expectation.total !== undefined) {
          expectedParts.push(`total ${expectation.total}`);
          actualParts.push(`total ${result.totalMovement}`);
          if (expectation.total !== result.totalMovement) problems.push('total differs');
        }
        if (expectation.finalHead !== undefined) {
          expectedParts.push(`final ${expectation.finalHead}`);
          actualParts.push(`final ${result.finalHead}`);
          if (expectation.finalHead !== result.finalHead) problems.push('final head differs');
        }
      } else {
        expectedParts.push('general rules only');
        actualParts.push(`path ${result.path.join('→')}, total ${result.totalMovement}`);
      }

      rows.push({
        test: testCase.name,
        algorithm: name,
        expected: expectedParts.join('; '),
        actual: actualParts.join('; ') + (problems.length ? ` (${problems.join('; ')})` : ''),
        pass: problems.length === 0,
      });
    }
  }
  return rows;
}

/** Many random workloads checked only against the general rules. */
export function runRandomChecks(count = 300, seed = 2024) {
  const random = seededRandom(seed);
  const failures = [];
  for (let i = 0; i < count; i++) {
    const diskSize = 2 + Math.floor(random() * 400);
    const input = {
      diskSize,
      initialHead: Math.floor(random() * diskSize),
      direction: random() < 0.5 ? 'LEFT' : 'RIGHT',
      requests: Array.from({ length: 1 + Math.floor(random() * 15) }, () => Math.floor(random() * diskSize)),
    };
    const scan = runAlgorithm('SCAN', input);
    const look = runAlgorithm('LOOK', input);
    for (const name of ALGORITHMS) {
      const problems = checkInvariants(name, input, runAlgorithm(name, input));
      if (problems.length) failures.push({ name, input, problems });
    }
    if (look.totalMovement > scan.totalMovement) failures.push({ name: 'LOOK vs SCAN', input, problems: ['LOOK moved more than SCAN'] });
  }
  return { count, failures };
}
