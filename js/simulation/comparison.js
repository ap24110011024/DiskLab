/* Small comparison helpers used by the arena, SCAN vs LOOK and analytics pages. */

/** Names with the lowest total movement (several when tied). */
export function lowestMovement(results) {
  const list = Object.values(results);
  const lowest = Math.min(...list.map((r) => r.totalMovement));
  return { lowest, names: list.filter((r) => r.totalMovement === lowest).map((r) => r.algorithm) };
}

/**
 * Extra travel SCAN makes compared with LOOK on the same input. Returns the
 * boundary segment (from LOOK's turning point to the edge) when there is one.
 */
export function scanLookDifference(scan, look) {
  const extra = scan.totalMovement - look.totalMovement;
  const boundaryStep = scan.steps.find((s) => s.type === 'BOUNDARY');
  return {
    extra,
    segment: boundaryStep ? { from: boundaryStep.from, to: boundaryStep.to } : null,
  };
}
