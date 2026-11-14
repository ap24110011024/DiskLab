/*
 * Input validation. The form helpers take raw text and return messages;
 * checkAlgorithmInput() is the last guard inside every algorithm and throws.
 */

export const LIMITS = { MIN_DISK: 2, MAX_DISK: 10000, MAX_REQUESTS: 60 };
const WHOLE = /^\d+$/;

function parseWhole(text, label) {
  const value = String(text ?? '').trim();
  if (value === '') return { error: `${label} is required.` };
  if (/^-\d+$/.test(value)) return { error: `${label} cannot be negative.` };
  if (!WHOLE.test(value)) return { error: `${label} must be a whole number.` };
  return { value: Number(value) };
}

export function validateDiskSize(text) {
  const result = parseWhole(text, 'Disk size');
  if (result.error) return result;
  if (result.value < LIMITS.MIN_DISK || result.value > LIMITS.MAX_DISK) {
    return { error: `Disk size must be between ${LIMITS.MIN_DISK} and ${LIMITS.MAX_DISK} cylinders.` };
  }
  return result;
}

export function validateHead(text, diskSize) {
  const result = parseWhole(text, 'Head position');
  if (result.error) return result;
  if (diskSize && result.value > diskSize - 1) {
    return { error: `Head position must be between 0 and ${diskSize - 1}.` };
  }
  return result;
}

/** Checks one cylinder typed into the queue editor. */
export function validateCylinder(text, diskSize) {
  const result = parseWhole(text, 'Request');
  if (result.error) return result;
  if (result.value > diskSize - 1) {
    return { error: `${result.value} is outside the disk (0 to ${diskSize - 1}).` };
  }
  return result;
}

/** Splits "82, 43 170" into tokens and validates each one. */
export function parseCylinderList(text, diskSize) {
  const tokens = String(text ?? '').split(/[\s,]+/).filter(Boolean);
  if (tokens.length === 0) return { error: 'Type at least one cylinder number.' };
  const values = [];
  for (const token of tokens) {
    const result = validateCylinder(token, diskSize);
    if (result.error) return { error: `"${token}": ${result.error}` };
    values.push(result.value);
  }
  return { value: values };
}

export function validateDirection(value) {
  return value === 'LEFT' || value === 'RIGHT' ? { value } : { error: 'Choose LEFT or RIGHT.' };
}

/** Checks a whole workload object before it is sent to an algorithm. */
export function validateWorkload(workload) {
  const errors = {};
  const { diskSize, initialHead, direction, requests } = workload;
  if (!Number.isInteger(diskSize) || diskSize < LIMITS.MIN_DISK || diskSize > LIMITS.MAX_DISK) {
    errors.diskSize = `Disk size must be between ${LIMITS.MIN_DISK} and ${LIMITS.MAX_DISK}.`;
  }
  if (!Number.isInteger(initialHead) || initialHead < 0 || (errors.diskSize === undefined && initialHead > diskSize - 1)) {
    errors.initialHead = 'Head position must be inside the disk.';
  }
  if (direction !== 'LEFT' && direction !== 'RIGHT') errors.direction = 'Choose LEFT or RIGHT.';
  if (!Array.isArray(requests) || requests.length === 0) {
    errors.requests = 'Add at least one request.';
  } else if (requests.length > LIMITS.MAX_REQUESTS) {
    errors.requests = `Use at most ${LIMITS.MAX_REQUESTS} requests.`;
  } else if (requests.some((r) => !Number.isInteger(r.cylinder) || r.cylinder < 0 || r.cylinder > diskSize - 1)) {
    errors.requests = 'Every request must be inside the disk range.';
  }
  return { isValid: Object.keys(errors).length === 0, errors };
}

/** Guard used by the algorithms. An empty queue is allowed (zero movement). */
export function checkAlgorithmInput(input) {
  const { diskSize, initialHead, direction, requests } = input || {};
  if (!Number.isInteger(diskSize) || diskSize < 1) throw new Error(`Invalid disk size: ${diskSize}`);
  if (!Number.isInteger(initialHead) || initialHead < 0 || initialHead > diskSize - 1) {
    throw new Error(`Invalid head position: ${initialHead}`);
  }
  if (direction !== 'LEFT' && direction !== 'RIGHT') throw new Error(`Invalid direction: ${direction}`);
  if (!Array.isArray(requests)) throw new Error('Requests must be an array.');
  for (const request of requests) {
    const cylinder = typeof request === 'number' ? request : request?.cylinder;
    if (!Number.isInteger(cylinder) || cylinder < 0 || cylinder > diskSize - 1) {
      throw new Error(`Invalid request cylinder: ${cylinder}`);
    }
  }
}
