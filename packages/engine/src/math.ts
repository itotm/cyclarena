// Integer, deterministic math: the tables are written by hand (not
// computed with Math.sin) because the result must be identical on every
// browser, operating system and Node version.

/** Scale factor of sin() and cos(): sin(90) = SCALE. */
export const SCALE = 10000;

// sin(d) * 10000 rounded, d = 0..90
const SIN_TABLE = Int32Array.from([0, 175, 349, 523, 698, 872, 1045, 1219, 1392, 1564, 1736, 1908, 2079, 2250, 2419, 2588, 2756, 2924, 3090, 3256, 3420, 3584, 3746, 3907, 4067, 4226, 4384, 4540, 4695, 4848, 5000, 5150, 5299, 5446, 5592, 5736, 5878, 6018, 6157, 6293, 6428, 6561, 6691, 6820, 6947, 7071, 7193, 7314, 7431, 7547, 7660, 7771, 7880, 7986, 8090, 8192, 8290, 8387, 8480, 8572, 8660, 8746, 8829, 8910, 8988, 9063, 9135, 9205, 9272, 9336, 9397, 9455, 9511, 9563, 9613, 9659, 9703, 9744, 9781, 9816, 9848, 9877, 9903, 9925, 9945, 9962, 9976, 9986, 9994, 9998, 10000]);

// tan(d + 0.5) * 10000 rounded, d = 0..44: thresholds for rounding
// the arctangent to the nearest degree
const TAN_MID = Int32Array.from([87, 262, 437, 612, 787, 963, 1139, 1317, 1495, 1673, 1853, 2035, 2217, 2401, 2586, 2773, 2962, 3153, 3346, 3541, 3739, 3939, 4142, 4348, 4557, 4770, 4986, 5206, 5430, 5658, 5890, 6128, 6371, 6619, 6873, 7133, 7400, 7673, 7954, 8243, 8541, 8847, 9163, 9490, 9827]);

/** Brings any angle into the range 0..359. */
export function normDeg(d: number): number {
  d %= 360;
  return d < 0 ? d + 360 : d;
}

export function isin(deg: number): number {
  const d = normDeg(deg);
  if (d <= 90) return SIN_TABLE[d];
  if (d <= 180) return SIN_TABLE[180 - d];
  if (d <= 270) return -SIN_TABLE[d - 180];
  return -SIN_TABLE[360 - d];
}

export function icos(deg: number): number {
  return isin(deg + 90);
}

/** Arctangent in whole degrees 0..359 (0 = east, 90 = north). atan2(0,0) = 0. */
export function iatan2(y: number, x: number): number {
  if (x === 0 && y === 0) return 0;
  const ax = Math.abs(x), ay = Math.abs(y);
  // angle in the first octant (0..45) via the tangent table
  const lo = Math.min(ax, ay), hi = Math.max(ax, ay);
  const ratio = Math.floor((lo * SCALE) / hi); // integer values < 2^53: exact
  let a = 0;
  while (a < 45 && ratio >= TAN_MID[a]) a++;
  if (ay > ax) a = 90 - a; // second octant
  if (x < 0) a = 180 - a;
  if (y < 0) a = 360 - a;
  return normDeg(a);
}

/** Integer square root (rounded down) of a non-negative integer < 2^53. */
export function isqrt(n: number): number {
  if (n <= 0) return 0;
  let r = Math.floor(Math.sqrt(n));
  while (r * r > n) r--;
  while ((r + 1) * (r + 1) <= n) r++;
  return r;
}

/**
 * Distance √(dx² + dy²) rounded down, for any 32-bit dx and dy (beyond 2^53
 * it switches to BigInt, so it stays exact); at most 2147483647.
 */
export function idist(dx: number, dy: number): number {
  const s = dx * dx + dy * dy;
  if (s <= Number.MAX_SAFE_INTEGER) return isqrt(s);
  const n = BigInt(dx) * BigInt(dx) + BigInt(dy) * BigInt(dy);
  let r = BigInt(Math.floor(Math.sqrt(Number(n))));
  while (r * r > n) r--;
  while ((r + 1n) * (r + 1n) <= n) r++;
  return Number(r > 2147483647n ? 2147483647n : r);
}

/** Rounds to the nearest integer, symmetric around zero. */
export function roundDiv(a: number, b: number): number {
  const q = a / b;
  return q < 0 ? -Math.round(-q) : Math.round(q);
}

/** sfc32 pseudo-random generator: fast and identical on every platform. */
export class Rng {
  private a: number; private b: number; private c: number; private d: number;

  constructor(seed: number, stream = 0) {
    this.a = 0x9e3779b9; this.b = seed | 0; this.c = (stream * 0x85ebca6b) | 0; this.d = 1;
    for (let i = 0; i < 12; i++) this.next();
  }

  /** Unsigned 32-bit integer. */
  next(): number {
    const t = (((this.a + this.b) | 0) + this.d) | 0;
    this.d = (this.d + 1) | 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) | 0;
    this.c = (this.c << 21) | (this.c >>> 11);
    this.c = (this.c + t) | 0;
    return t >>> 0;
  }

  /** Integer in 0..n-1 (0 if n <= 0). */
  below(n: number): number {
    return n <= 0 ? 0 : this.next() % n;
  }
}

/** Mixes two integers into a seed (to derive per-match and per-robot seeds). */
export function mixSeed(a: number, b: number): number {
  let h = (Math.imul(a ^ 0x5bd1e995, 0x27d4eb2d) ^ b) | 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return (h ^ (h >>> 15)) >>> 0;
}
