// shor-core.ts: a small simulator of shor's period-finding circuit.
//
// what it simulates gate by gate on a state vector:
//   - t "counting" qubits put into an even superposition (hadamards)
//   - the quantum fourier transform (hadamards, controlled-phase gates, bit reversal)
//   - measuring the counting register (sampling from |amplitude|^2)
// what it shortcuts:
//   - the controlled modular exponentiation |x>|1> -> |x>|a^x mod n>. we work out the table a^x mod n
//     with normal code and use it to build the state. a real quantum machine needs lots of extra qubits
//     and gates for this step, and that's the expensive part.
// the classical part at the end (continued fractions, gcd) is the real algorithm.
//
// this is a normal program pretending to be a quantum circuit, on a tiny number. it can't break real rsa.

// types
export type Rng = () => number;
export interface NoiseSettings { readout?: number; depol?: number }
export interface State { t: number; Q: number; re: Float64Array; im: Float64Array }
export type Gate =
  | { type: 'H'; q: number }
  | { type: 'CP'; c: number; q: number; k: number }
  | { type: 'SWAP'; a: number; b: number };
export interface TargetClass { y: number; xs: number[]; weight: number }
export interface Analysis {
  a: number; N: number; t: number; Q: number;
  targets: TargetClass[];
  classes: Map<number, number[]>;
  dist: (M: number, xs: number[]) => Float64Array;
  trueOrder: number | null; // only used to draw the teaching charts, the algorithm never looks at it
}
export interface Shot { y0: number; kIdeal: number; k: number }
export interface Convergent { num: number; den: number }
export interface OrderResult { k: number; convergents: Convergent[]; r: number | null; from?: Convergent; multiple?: number }
export type Factors =
  | { ok: true; p: number; q: number; half?: number }
  | { ok: false; reason: string };
export interface ShotRecord { i: number; y0: number; k: number; kIdeal: number; conv: Convergent[]; r: number | null }
export interface Attempt { a: number; N: number; t: number; analysis: Analysis; shots: ShotRecord[]; r: number | null; factors: Factors }
export interface Lucky { a: number; lucky: number }
export interface AttemptOptions { t?: number; rng?: Rng; shots?: number; noise?: NoiseSettings | null; analysis?: Analysis; stopEarly?: boolean }
export interface ShorOptions { a?: number | null; t?: number; rng?: Rng; shots?: number; noise?: NoiseSettings | null; maxTries?: number; stopEarly?: boolean }
export interface ShorResult { N: number; tries: Array<Attempt | Lucky>; factors: Factors; trivial?: string }
export interface RSAKey { p: number; q: number; N: number; phi: number; e: number; d: number | null }

// small number theory helpers (plain js numbers are fine because n < 2^26)
export function gcd(a: number, b: number): number { while (b) { const t = a % b; a = b; b = t; } return a; }
export function lcm(a: number, b: number): number { return (a / gcd(a, b)) * b; }
export function modPow(base: number, exp: number, mod: number): number {
  let r = 1; base %= mod;
  while (exp > 0) { if (exp & 1) r = (r * base) % mod; base = (base * base) % mod; exp = Math.floor(exp / 2); }
  return r;
}
export function modInverse(a: number, m: number): number | null {
  let [oldR, r] = [a, m], [oldS, s] = [1, 0];
  while (r !== 0) { const q = Math.floor(oldR / r); [oldR, r] = [r, oldR - q * r]; [oldS, s] = [s, oldS - q * s]; }
  if (oldR !== 1) return null;
  return ((oldS % m) + m) % m;
}
export function bitLength(n: number): number { return n.toString(2).length; }
export function isPrime(n: number): boolean { if (n < 2) return false; for (let i = 2; i * i <= n; i++) if (n % i === 0) return false; return true; }
export function isPrimePower(n: number): boolean {
  for (let p = 2; p * p <= n; p++) {
    if (n % p === 0) { let m = n; while (m % p === 0) m /= p; return m === 1; }
  }
  return isPrime(n);
}
// brute-force order, only used to check answers and draw the ideal spikes
export function classicalOrder(a: number, N: number): number | null {
  let x = a % N, r = 1;
  while (x !== 1) { x = (x * a) % N; r++; if (r > N) return null; }
  return r;
}

// seeded random numbers so tests and demos can be repeated (mulberry32)
export function makeRng(seed?: number | null): Rng {
  if (seed === undefined || seed === null) return Math.random;
  let s = seed >>> 0;
  return function (): number {
    s = (s + 0x6D2B79F5) >>> 0; let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// state vector with a few gates
export function makeState(t: number): State { const Q = 1 << t; return { t, Q, re: new Float64Array(Q), im: new Float64Array(Q) }; }

export function applyH(s: State, q: number): void {
  const bit = 1 << q, k = Math.SQRT1_2, { re, im, Q } = s;
  for (let i = 0; i < Q; i++) {
    if (i & bit) continue;
    const j = i | bit;
    const ar = re[i], ai = im[i], br = re[j], bi = im[j];
    re[i] = (ar + br) * k; im[i] = (ai + bi) * k;
    re[j] = (ar - br) * k; im[j] = (ai - bi) * k;
  }
}
export function applyCPhase(s: State, control: number, target: number, theta: number): void {
  const mask = (1 << control) | (1 << target), c = Math.cos(theta), sn = Math.sin(theta), { re, im, Q } = s;
  for (let i = 0; i < Q; i++) {
    if ((i & mask) !== mask) continue;
    const r = re[i], m = im[i];
    re[i] = r * c - m * sn; im[i] = r * sn + m * c;
  }
}
export function applySwap(s: State, q1: number, q2: number): void {
  const b1 = 1 << q1, b2 = 1 << q2, { re, im, Q } = s;
  for (let i = 0; i < Q; i++) {
    if ((i & b1) && !(i & b2)) {
      const j = (i ^ b1) | b2;
      let tmp = re[i]; re[i] = re[j]; re[j] = tmp;
      tmp = im[i]; im[i] = im[j]; im[j] = tmp;
    }
  }
}
// qft: |x> -> (1/sqrt(q)) sum_k exp(2*pi*i*x*k/q) |k>, built from hadamards and controlled-phase gates
export function qftGates(t: number): Gate[] {
  const g: Gate[] = [];
  for (let j = t - 1; j >= 0; j--) {
    g.push({ type: 'H', q: j });
    for (let m = j - 1; m >= 0; m--) g.push({ type: 'CP', c: m, q: j, k: j - m + 1 }); // angle = 2*pi/2^k
  }
  for (let i = 0; i < Math.floor(t / 2); i++) g.push({ type: 'SWAP', a: i, b: t - 1 - i });
  return g;
}
export function applyQFT(s: State): void {
  for (const g of qftGates(s.t)) {
    if (g.type === 'H') applyH(s, g.q);
    else if (g.type === 'CP') applyCPhase(s, g.c, g.q, (2 * Math.PI) / Math.pow(2, g.k));
    else applySwap(s, g.a, g.b);
  }
}
export function probabilities(s: State): Float64Array {
  const p = new Float64Array(s.Q);
  for (let i = 0; i < s.Q; i++) p[i] = s.re[i] * s.re[i] + s.im[i] * s.im[i];
  return p;
}

// the period-finding experiment for a given a, n, t
export function analyze(a: number, N: number, t: number): Analysis {
  const Q = 1 << t;
  const classes = new Map<number, number[]>(); // target value y -> list of x where a^x mod n = y
  let y = 1;
  for (let x = 0; x < Q; x++) {
    let list = classes.get(y);
    if (!list) { list = []; classes.set(y, list); }
    list.push(x);
    y = (y * a) % N;
  }
  return finishAnalysis(a, N, t, classes, classicalOrder(a, N));
}

// the same experiment for any function f, not just a^x mod n.
// if f has a hidden loop, the measurements pile up on spikes. if it doesn't, they don't
export function analyzeFunction(f: (x: number) => number, t: number): Analysis {
  const Q = 1 << t;
  const classes = new Map<number, number[]>(); // value of f -> list of x that give it
  for (let x = 0; x < Q; x++) {
    const y = f(x);
    let list = classes.get(y);
    if (!list) { list = []; classes.set(y, list); }
    list.push(x);
  }
  return finishAnalysis(0, 0, t, classes, null);
}

function finishAnalysis(a: number, N: number, t: number, classes: Map<number, number[]>, trueOrder: number | null): Analysis {
  const Q = 1 << t;
  // classes with the same size give the same measurement chances (they only differ by a phase)
  const distCache = new Map<number, Float64Array>();
  function dist(M: number, xs: number[]): Float64Array {
    let p = distCache.get(M);
    if (!p) {
      const s = makeState(t), amp = 1 / Math.sqrt(xs.length);
      for (const x of xs) s.re[x] = amp;
      applyQFT(s);
      p = probabilities(s);
      distCache.set(M, p);
    }
    return p;
  }
  const targets: TargetClass[] = [...classes.entries()].map(([val, xs]) => ({ y: val, xs, weight: xs.length / Q }));
  return { a, N, t, Q, targets, classes, dist, trueOrder };
}

function sampleFrom(probs: Float64Array, rng: Rng): number {
  const u = rng(); let acc = 0;
  for (let i = 0; i < probs.length; i++) { acc += probs[i]; if (u < acc) return i; }
  return probs.length - 1;
}

// noise models:
// - depolarizing: with probability q the whole run is scrambled and the result is totally random
// - readout: every counting bit flips on its own with probability p
export function applyNoise(k: number, t: number, noise: NoiseSettings | null | undefined, rng: Rng): number {
  if (!noise) return k;
  if ((noise.depol ?? 0) > 0 && rng() < (noise.depol as number)) k = Math.floor(rng() * (1 << t));
  if ((noise.readout ?? 0) > 0) for (let b = 0; b < t; b++) if (rng() < (noise.readout as number)) k ^= (1 << b);
  return k;
}

// one full run of the circuit: the measured target value, the ideal result and the noisy result
export function runShot(an: Analysis, rng: Rng, noise?: NoiseSettings | null): Shot {
  // measure the target register: pick a class with probability |class| / q
  const u = rng(); let acc = 0, cls = an.targets[an.targets.length - 1];
  for (const c of an.targets) { acc += c.weight; if (u < acc) { cls = c; break; } }
  const p = an.dist(cls.xs.length, cls.xs);
  const kIdeal = sampleFrom(p, rng);
  const k = applyNoise(kIdeal, an.t, noise, rng);
  return { y0: cls.y, kIdeal, k };
}

// classical post-processing
export function convergents(num: number, den: number): Convergent[] {
  const out: Convergent[] = []; let h1 = 1, h0 = 0, k1 = 0, k0 = 1, n = num, d = den;
  while (d !== 0) {
    const q = Math.floor(n / d); [n, d] = [d, n - q * d];
    const h2 = q * h1 + h0, k2 = q * k1 + k0; h0 = h1; h1 = h2; k0 = k1; k1 = k2;
    out.push({ num: h1, den: k1 });
  }
  return out;
}
// from one measurement k (so the phase is k/q), try to find r where a^r = 1 (mod n)
export function orderFromMeasurement(k: number, Q: number, a: number, N: number): OrderResult {
  if (k === 0) return { k, convergents: [], r: null };
  const conv = convergents(k, Q).filter(c => c.den > 0 && c.den < N);
  for (const c of conv) {
    for (let m = 1; m <= 4; m++) {
      const r = c.den * m;
      if (r < N && modPow(a, r, N) === 1) return { k, convergents: conv, r, from: c, multiple: m };
    }
  }
  return { k, convergents: conv, r: null };
}
export function factorsFromOrder(a: number, N: number, r: number): Factors {
  if (r % 2 !== 0) return { ok: false, reason: 'r is odd' };
  const x = modPow(a, r / 2, N);
  if (x === N - 1) return { ok: false, reason: 'a^(r/2) = -1 (mod N)' };
  const p = gcd(x - 1 + N, N), q = gcd(x + 1, N);
  for (const f of [p, q]) if (f > 1 && f < N) { const g = Math.min(f, N / f); return { ok: true, p: g, q: N / g, half: x }; }
  return { ok: false, reason: 'gcd gave only trivial factors' };
}

// one attempt with a fixed base a: run all the shots and keep the smallest valid order
export function attempt(N: number, a: number, opts: AttemptOptions = {}): Attempt {
  const t = opts.t || 2 * bitLength(N), rng = opts.rng || Math.random, shots = opts.shots || 20, noise = opts.noise || null;
  const an = opts.analysis || analyze(a, N, t);
  const list: ShotRecord[] = []; let best: number | null = null;
  for (let i = 0; i < shots; i++) {
    const s = runShot(an, rng, noise), o = orderFromMeasurement(s.k, an.Q, a, N);
    list.push({ i: i + 1, y0: s.y0, k: s.k, kIdeal: s.kIdeal, conv: o.convergents, r: o.r });
    if (o.r && (best === null || o.r < best)) best = o.r;
    if (opts.stopEarly && best) {
      const f = factorsFromOrder(a, N, best); if (f.ok) break;
    }
  }
  const f: Factors = best ? factorsFromOrder(a, N, best) : { ok: false, reason: 'no valid order found' };
  return { a, N, t, analysis: an, shots: list, r: best, factors: f };
}

// the whole algorithm: keep picking a until we get factors
export function shor(N: number, opts: ShorOptions = {}): ShorResult {
  const rng = opts.rng || Math.random, maxTries = opts.maxTries || 8, tries: Array<Attempt | Lucky> = [];
  if (N % 2 === 0) return { N, tries, factors: { ok: true, p: 2, q: N / 2 }, trivial: 'N is even' };
  for (let i = 0; i < maxTries; i++) {
    const a = opts.a && i === 0 ? opts.a : 2 + Math.floor(rng() * (N - 3));
    const g = gcd(a, N);
    if (g > 1) {
      tries.push({ a, lucky: g });
      return { N, tries, factors: { ok: true, p: Math.min(g, N / g), q: Math.max(g, N / g) }, trivial: 'gcd(a, N) > 1 (lucky guess, no quantum step needed)' };
    }
    const at = attempt(N, a, { t: opts.t, rng, shots: opts.shots, noise: opts.noise, stopEarly: opts.stopEarly !== false });
    tries.push(at);
    if (at.factors.ok) return { N, tries, factors: at.factors };
  }
  return { N, tries, factors: { ok: false, reason: 'no factors after ' + maxTries + ' tries' } };
}

// how often a single shot gives a valid order, for a list of noise levels
export function noiseSweep(N: number, a: number, levels: number[], kind: 'readout' | 'depol', trials: number, rng: Rng, t?: number): number[] {
  const tt = t || 2 * bitLength(N);
  const an = analyze(a, N, tt), out: number[] = [];
  for (const lv of levels) {
    const noise: NoiseSettings = kind === 'depol' ? { depol: lv } : { readout: lv };
    let ok = 0;
    for (let i = 0; i < trials; i++) { const s = runShot(an, rng, noise); if (orderFromMeasurement(s.k, an.Q, a, N).r) ok++; }
    out.push(ok / trials);
  }
  return out;
}

// toy rsa used by the demo
export function makeRSA(p: number, q: number): RSAKey {
  const N = p * q, phi = (p - 1) * (q - 1);
  let e = 3; for (const c of [3, 5, 7, 11, 13, 17, 19, 23]) { if (gcd(c, phi) === 1) { e = c; break; } }
  return { p, q, N, phi, e, d: modInverse(e, phi) };
}
export function textToNumbers(text: string): number[] { return [...text.toUpperCase().replace(/[^A-Z]/g, '')].map(c => c.charCodeAt(0) - 64); } // a=1 ... z=26
export function numbersToText(nums: number[]): string { return nums.map(n => (n >= 1 && n <= 26) ? String.fromCharCode(n + 64) : '?').join(''); }
export function rsaEncrypt(nums: number[], N: number, e: number): number[] { return nums.map(m => modPow(m, e, N)); }
export function rsaDecrypt(cts: number[], N: number, d: number): number[] { return cts.map(c => modPow(c, d, N)); }
// attacker: only knows n and e, gets p and q from shor, then rebuilds d
export function rsaPrivateFromFactors(p: number, q: number, e: number): number | null { return modInverse(e, (p - 1) * (q - 1)); }
