/*
 * "What will the algorithm do next?" Builds answer options for a step from
 * the real result: the correct next target plus other pending cylinders
 * (and the boundary option for SCAN). The answer is always the algorithm's
 * own choice, never a separately calculated one.
 */

export function buildPrediction(result, stepIndex) {
  const step = result.steps[stepIndex];
  if (!step) return null;

  const correct = step.type === 'BOUNDARY' ? `boundary-${step.to}` : `cyl-${step.to}`;
  const options = new Map();
  options.set(correct, step.type === 'BOUNDARY' ? `Travel to the boundary (${step.to})` : `Cylinder ${step.to}`);

  // Other pending cylinders, nearest first, as distractors.
  const others = [...new Set(step.pendingBefore.map((r) => r.cylinder))]
    .filter((c) => `cyl-${c}` !== correct)
    .sort((a, b) => Math.abs(a - step.from) - Math.abs(b - step.from));
  for (const cylinder of others.slice(0, 3)) options.set(`cyl-${cylinder}`, `Cylinder ${cylinder}`);

  if (result.algorithm === 'SCAN' && step.type !== 'BOUNDARY' && options.size < 5) {
    const edge = step.sweep === 'RIGHT' ? result.diskSize - 1 : 0;
    if (!options.has(`boundary-${edge}`) && step.from !== edge) options.set(`boundary-${edge}`, `Travel to the boundary (${edge})`);
  }

  // Shuffle-free but not always first: sort options by label so the answer position varies.
  const list = [...options.entries()].map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
  return { question: 'What do you think the algorithm will do next?', options: list, correct, explanation: step.reason, title: step.title };
}
