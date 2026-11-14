/*
 * Performance metrics. Every page uses these same definitions.
 *
 *  Total head movement   sum of |next - current| over the whole head path,
 *                        including SCAN's trip to the disk boundary.
 *  Average per request   total / number of requests (0 when there are none).
 *  Direction changes     reversals between movements that actually move the
 *                        head; zero-distance moves are ignored.
 * All values are in cylinders. Nothing here is a time measurement.
 */

export function roundTo2(value) {
  return Math.round(value * 100) / 100;
}

export function moveDirection(from, to) {
  if (to > from) return 'RIGHT';
  if (to < from) return 'LEFT';
  return 'NONE';
}

export function totalMovement(path) {
  let total = 0;
  for (let i = 1; i < path.length; i++) total += Math.abs(path[i] - path[i - 1]);
  return total;
}

export function averageMovement(total, requestCount) {
  return requestCount === 0 ? 0 : roundTo2(total / requestCount);
}

export function countDirectionChanges(path) {
  let changes = 0;
  let previous = null;
  for (let i = 1; i < path.length; i++) {
    const direction = moveDirection(path[i - 1], path[i]);
    if (direction === 'NONE') continue;
    if (previous !== null && direction !== previous) changes++;
    previous = direction;
  }
  return changes;
}
