/*
 * Command-line test runner (optional, needs Node.js 18+):
 *     node tests/run-tests.mjs
 * Runs the same test cases as the Testing Playground page, plus random checks.
 */
import { runTestCases, runRandomChecks } from '../js/testing/test-runner.js';
import { generateCylinders, WORKLOAD_TYPES } from '../js/input/workload-generator.js';
import { validateWorkload, parseCylinderList, validateDiskSize, validateHead } from '../js/validation.js';
import { armAngleForRadius, radiusForCylinder } from '../js/visualization/disk-platter-3d.js';

let failed = 0;
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok ? '' : `  ${detail}`}`);
  if (!ok) failed++;
};

for (const row of runTestCases()) check(`${row.test} [${row.algorithm}]`, row.pass, row.actual);

const random = runRandomChecks(400);
check(`${random.count} random workloads satisfy every invariant`, random.failures.length === 0, JSON.stringify(random.failures[0]));

for (const type of Object.keys(WORKLOAD_TYPES)) {
  const a = generateCylinders({ type, diskSize: 200, head: 100, count: 12, seed: 7 });
  const b = generateCylinders({ type, diskSize: 200, head: 100, count: 12, seed: 7 });
  check(`workload "${type}" is repeatable and in range`, JSON.stringify(a) === JSON.stringify(b) && a.every((c) => c >= 0 && c <= 199) && a.length > 0);
}

check('validation rejects negative / text / out of range', Boolean(parseCylinderList('5, -1', 200).error && parseCylinderList('5, x', 200).error && parseCylinderList('200', 200).error));
check('validation accepts duplicates', JSON.stringify(parseCylinderList('5 5,0 199', 200).value) === '[5,5,0,199]');
check('disk size and head checks', Boolean(validateDiskSize('1').error && validateDiskSize('abc').error && validateHead('200', 200).error) && validateHead('199', 200).value === 199);
check('empty queue is rejected for simulation', validateWorkload({ diskSize: 200, initialHead: 0, direction: 'LEFT', requests: [] }).isValid === false);

// The 3D arm must reach every cylinder: tip distance from centre equals the track radius.
let armOk = true;
for (const cylinder of [0, 50, 100, 199]) {
  const r = radiusForCylinder(cylinder, 200);
  const { tipX, tipY } = armAngleForRadius(r);
  if (Math.abs(Math.hypot(tipX - 50, tipY - 50) - r) > 0.01) armOk = false;
}
check('3D actuator arm tip lands on the correct track radius', armOk);

console.log(failed === 0 ? '\nALL TESTS PASSED' : `\n${failed} TEST(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);
