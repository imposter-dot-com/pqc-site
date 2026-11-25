// shor's algorithm for the discrete log on an elliptic curve (the maths behind breaking x25519).
//
// the problem: you are given a point P and a point Q = k*P, and you want the secret number k.
//
// the trick: put two registers (a and b) into superposition and compute f(a, b) = a*P + b*Q.
// that is the same point whenever a + k*b is the same number (mod r), so f has a hidden "loop" in two directions.
// measuring f leaves a state that is spread over all (a, b) on one such line, and the fourier transform
// turns that line into points (u, v) that all satisfy  v = k*u (mod r).
// so one good measurement gives k = v / u (mod r).
//
// what is simulated for real: the function a*P + b*Q (built only from the public points P and Q),
// the measurement of f, the fourier transform over the two registers (worked out amplitude by amplitude),
// and the measurement of (u, v). the secret k is never used until the very last check.
// what is idealised: we use an exact fourier transform over the numbers mod r, with no noise.
import { sampleFrom } from './shor-core.ts';
import type { Rng } from './shor-core.ts';
import { CURVE, add, inverse, mul, neg, samePoint } from '../crypto/toy-ec.ts';
import type { Point, Pt } from '../crypto/toy-ec.ts';

export interface DlogShot { u: number; v: number; k: number | null }

export interface DlogRun {
  k: number | null;       // the secret that was found, or null
  r: number;              // the number of points in the group
  shots: DlogShot[];      // each measurement of (u, v), and what it gave
  registerQubits: number; // qubits in each of the two counting registers
  pointQubits: number;    // qubits that hold the curve point f(a, b)
  groupSize: number;      // how many (a, b) pairs are in superposition: r * r
}

const bits = (n: number): number => Math.ceil(Math.log2(n));

// the key we use to look up a point in a table
const keyOf = (P: Pt): number => (P ? P.x * CURVE.p + P.y : -1);

// how many times you can add P to itself before you get back to zero
function orderOf(P: Point): number {
  let count = 1;
  let current: Pt = P;
  while (current) { current = add(current, P); count++; }
  return count;
}

export function shorDiscreteLog(P: Point, Q: Point, opts: { maxShots?: number; rng?: Rng; stopEarly?: boolean } = {}): DlogRun {
  const rng = opts.rng ?? Math.random;
  const maxShots = opts.maxShots ?? 10;
  const stopEarly = opts.stopEarly ?? true; // stop at the first shot that gives the secret
  const r = orderOf(P);

  // multiples of P and of Q, worked out from the public points only
  const multiplesP: Pt[] = [];
  const indexOfP = new Map<number, number>(); // point -> the number a with a*P = point
  let current: Pt = null;
  for (let a = 0; a < r; a++) {
    multiplesP.push(current);
    indexOfP.set(keyOf(current), a);
    current = add(current, P);
  }
  const multiplesQ: Pt[] = [];
  current = null;
  for (let b = 0; b < r; b++) { multiplesQ.push(current); current = add(current, Q); }

  // measure the output register: it gives a random point R of the group
  const R = multiplesP[Math.floor(rng() * r)]!;

  // the (a, b) pairs left in superposition are the ones with a*P + b*Q = R. there is exactly one a for each b
  const pairs: Array<[number, number]> = [];
  for (let b = 0; b < r; b++) {
    const a = indexOfP.get(keyOf(add(R, neg(multiplesQ[b]!))));
    if (a !== undefined) pairs.push([a, b]);
  }

  // the fourier transform over both registers: the amplitude at (u, v) adds up the waves from every pair
  const cos = new Float64Array(r);
  const sin = new Float64Array(r);
  for (let m = 0; m < r; m++) { cos[m] = Math.cos((2 * Math.PI * m) / r); sin[m] = Math.sin((2 * Math.PI * m) / r); }

  const chances = new Float64Array(r * r);
  let total = 0;
  for (let u = 0; u < r; u++) {
    for (let v = 0; v < r; v++) {
      let re = 0;
      let im = 0;
      for (const [a, b] of pairs) {
        const phase = (u * a + v * b) % r;
        re += cos[phase]!;
        im += sin[phase]!;
      }
      const chance = re * re + im * im;
      chances[u * r + v] = chance;
      total += chance;
    }
  }
  for (let i = 0; i < chances.length; i++) chances[i] = chances[i]! / total;

  // measure (u, v), then do the classical maths: k = v / u (mod r), and check that k*P really is Q
  const shots: DlogShot[] = [];
  let found: number | null = null;
  for (let i = 0; i < maxShots && !(stopEarly && found !== null); i++) {
    const index = sampleFrom(chances, rng);
    const u = Math.floor(index / r);
    const v = index % r;
    let k: number | null = null;
    if (u !== 0) {
      const guess = (v * inverse(u, r)) % r;
      if (samePoint(mul(guess, P), Q)) k = guess;
    }
    shots.push({ u, v, k });
    if (k !== null && found === null) found = k;
  }

  return { k: found, r, shots, registerQubits: bits(r), pointQubits: 2 * bits(CURVE.p), groupSize: r * r };
}
