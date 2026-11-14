/*
 * Workload generator. Uses a seeded random number generator (mulberry32) so
 * the same seed always produces the same workload, which makes experiments
 * repeatable. All values stay inside 0 .. diskSize - 1.
 */

/** Returns a function that gives a repeatable sequence of numbers in [0, 1). */
export function seededRandom(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomInt(random, min, max) {
  return min + Math.floor(random() * (max - min + 1));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export const WORKLOAD_TYPES = {
  random: { label: 'Random', hint: 'Any cylinder is equally likely.' },
  uniform: { label: 'Uniform distribution', hint: 'Evenly spread across the disk with a small jitter.' },
  leftHeavy: { label: 'Left-heavy', hint: 'About 80% of requests below the head.' },
  rightHeavy: { label: 'Right-heavy', hint: 'About 80% of requests above the head.' },
  clustered: { label: 'Clustered', hint: 'Requests gathered around two or three hot spots.' },
  ascending: { label: 'Ascending', hint: 'Random cylinders, queued in increasing order.' },
  descending: { label: 'Descending', hint: 'Random cylinders, queued in decreasing order.' },
  boundaryHeavy: { label: 'Boundary-heavy', hint: 'Most requests near cylinder 0 and the last cylinder.' },
  duplicates: { label: 'Duplicate-heavy', hint: 'A few cylinders requested several times.' },
  small: { label: 'Small workload', hint: 'Five random requests.' },
  large: { label: 'Large workload', hint: 'Forty random requests.' },
};

/**
 * Generates a list of cylinders.
 * options = { type, diskSize, head, count, seed }
 */
export function generateCylinders({ type, diskSize, head, count, seed }) {
  const random = seededRandom(seed);
  const last = diskSize - 1;
  const any = () => randomInt(random, 0, last);
  const values = [];

  if (type === 'small') count = 5;
  if (type === 'large') count = 40;

  switch (type) {
    case 'uniform': {
      const gap = last / Math.max(1, count);
      for (let i = 0; i < count; i++) {
        const jitter = randomInt(random, 0, Math.max(0, Math.floor(gap / 2)));
        values.push(clamp(Math.round(i * gap + jitter), 0, last));
      }
      break;
    }
    case 'leftHeavy':
    case 'rightHeavy': {
      const heavyLeft = type === 'leftHeavy';
      for (let i = 0; i < count; i++) {
        const onHeavySide = random() < 0.8;
        const left = heavyLeft ? onHeavySide : !onHeavySide;
        values.push(left ? randomInt(random, 0, Math.max(0, head - 1)) : randomInt(random, Math.min(last, head + 1), last));
      }
      break;
    }
    case 'clustered': {
      const centres = Array.from({ length: randomInt(random, 2, 3) }, any);
      const spread = Math.max(2, Math.round(diskSize * 0.04));
      for (let i = 0; i < count; i++) {
        const centre = centres[i % centres.length];
        values.push(clamp(centre + randomInt(random, -spread, spread), 0, last));
      }
      break;
    }
    case 'boundaryHeavy': {
      const band = Math.max(1, Math.round(diskSize * 0.08));
      for (let i = 0; i < count; i++) {
        if (random() < 0.85) values.push(random() < 0.5 ? randomInt(random, 0, band) : randomInt(random, last - band, last));
        else values.push(any());
      }
      break;
    }
    case 'duplicates': {
      const pool = Array.from({ length: Math.max(2, Math.round(count / 3)) }, any);
      for (let i = 0; i < count; i++) values.push(pool[randomInt(random, 0, pool.length - 1)]);
      break;
    }
    default:
      for (let i = 0; i < count; i++) values.push(any());
  }

  if (type === 'ascending') values.sort((a, b) => a - b);
  if (type === 'descending') values.sort((a, b) => b - a);
  return values;
}

export function newSeed() {
  return Math.floor(Math.random() * 1000000);
}
