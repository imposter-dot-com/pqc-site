// the same period-finding experiment as the simulator, but for any function.
// we run it on a function that has a hidden loop (a^x mod n, like rsa) and on one that doesn't,
// and count how often a measurement leads to a valid period.
import * as S from './shor-core.ts';

export interface PeriodShot { k: number; r: number | null }

export interface PeriodRun {
  shots: PeriodShot[];
  valid: number;          // how many shots led to a valid period
  blocks: Float64Array;   // the chance of each measured value, grouped into blocks
  Q: number;              // how many values the counting register can hold
}

// from one measurement k (so the phase is k/q), look for a period r where f(r) = f(0).
// it is the same recipe as for rsa, just checking f instead of a^r mod n
function periodFromMeasurement(k: number, Q: number, f: (x: number) => number): number | null {
  if (k === 0) return null;
  for (const c of S.convergents(k, Q)) {
    if (c.den <= 0 || c.den >= Q / 2) continue;
    for (let m = 1; m <= 4; m++) {
      const r = c.den * m;
      if (r < Q / 2 && f(r) === f(0) && f(1) === f(1 + r)) return r;
    }
  }
  return null;
}

// the chance of each measured value, added up into a number of blocks so it can be drawn
function toBlocks(chances: Float64Array, count: number): Float64Array {
  const out = new Float64Array(count);
  for (let i = 0; i < chances.length; i++) out[Math.min(count - 1, Math.floor((i * count) / chances.length))] += chances[i]!;
  return out;
}

export function periodExperiment(f: (x: number) => number, t: number, shots: number, rng: S.Rng, blocks = 64): PeriodRun {
  const analysis = S.analyzeFunction(f, t);
  const list: PeriodShot[] = [];
  let valid = 0;
  let spectrum: Float64Array | null = null;

  for (let i = 0; i < shots; i++) {
    const shot = S.runShot(analysis, rng);
    const r = periodFromMeasurement(shot.k, analysis.Q, f);
    list.push({ k: shot.k, r });
    if (r) valid++;
    if (!spectrum) spectrum = toBlocks(analysis.dist(analysis.classes.get(shot.y0)!.length, analysis.classes.get(shot.y0)!), blocks);
  }
  return { shots: list, valid, blocks: spectrum ?? new Float64Array(blocks), Q: analysis.Q };
}

// a function with no hidden loop: it scrambles x completely, using a seed.
// (the seed comes from a real ml-kem public key in the demo, but the scrambling is what removes any loop)
export function scrambledFunction(seed: number): (x: number) => number {
  return (x: number): number => {
    let h = (x ^ seed) >>> 0;
    h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    h ^= h >>> 16;
    return h >>> 8; // 24 bits
  };
}

// a number from the first 4 bytes of a hash of the bytes (a real key, in the demo)
export async function seedFromBytes(bytes: Uint8Array): Promise<number> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as unknown as BufferSource));
  return ((digest[0]! << 24) | (digest[1]! << 16) | (digest[2]! << 8) | digest[3]!) >>> 0;
}
