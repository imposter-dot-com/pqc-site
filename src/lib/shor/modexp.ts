// modexp.ts: the modular exponentiation of shor's algorithm, built from real gates (X, CNOT, Toffoli) and simulated gate by gate.
//
// the step it builds:  |x>|1>  ->  |x>|a^x mod N>
// how: for every counting qubit j, a controlled "multiply by a^(2^j) mod N". each multiplication is
//   1. out  += c * x   (mod N)    one controlled modular addition of the constant (c * 2^i mod N) for each bit i of x
//   2. swap x and out, controlled on the counting qubit
//   3. out  -= c^-1 * x (mod N)   which sets out back to 0
// a modular addition of a constant is the usual add, subtract N, fix up, uncompute-the-flag pattern, done with a ripple-carry
// adder (Vedral, Barenco and Ekert). this is NOT the smallest known circuit (it uses about t + 4n + 3 qubits), but every gate is real.
//
// why we can simulate it: these gates only move basis states around (no new superpositions). after the hadamards,
// the state is "every counting value x at once, each with its own copy of the work qubits". so we keep, for every
// qubit, one bit per counting value (a "bit plane"), and one gate updates 32 counting values at a time.
// pauli errors still work exactly: an X error flips a plane, a Z error flips the sign of the states where that qubit is 1.
//
// this is a normal program pretending to be a quantum circuit, on a tiny number. it can't break real rsa.

import * as S from './shor-core.ts';
import type { NoiseSettings, Rng, Shot } from './shor-core.ts';

export const H = 0, X = 1, CX = 2, CCX = 3; // H is not a real operation here: it only marks where a hadamard was, so it can fail
export type Op = typeof H | typeof X | typeof CX | typeof CCX;
type Tuple = [Op, number, number, number];

export interface Layout {
  cnt: number[];   // the t counting qubits (the controls)
  x: number[];     // n qubits, the register that holds a^s mod N at the end
  out: number[];   // n + 1 qubits, scratch for the multiplication (the extra bit catches overflow)
  cr: number[];    // n qubits, holds the constant being added
  carry: number[]; // n qubits, the carries of the adder
  flag: number;    // 1 qubit, remembers if the subtraction of N went negative
  and: number;     // 1 qubit, the AND of a counting qubit and a bit of x
  total: number;
}
export interface ModExpCircuit {
  N: number; a: number; t: number; n: number;
  layout: Layout;
  op: Uint8Array; q0: Int32Array; q1: Int32Array; q2: Int32Array;
  counts: GateCounts;
}
export interface GateCounts {
  qubits: number;
  hadamards: number;     // the layer that starts the counting register (not simulated as gates, but it can fail)
  oneQubit: number;      // X gates
  cnot: number;
  toffoli: number;
  twoQubitEquivalent: number; // a toffoli is about 6 two-qubit gates on real hardware
  total: number;         // all gates listed
}

export const TOFFOLI_COST = 6; // two-qubit gates in one toffoli (the standard decomposition)

// ---- building the circuit ----

function makeLayout(t: number, n: number): Layout {
  let next = 0;
  const take = (count: number): number[] => Array.from({ length: count }, () => next++);
  const cnt = take(t), x = take(n), out = take(n + 1), cr = take(n), carry = take(n), flag = take(1)[0]!, and = take(1)[0]!;
  return { cnt, x, out, cr, carry, flag, and, total: next };
}

const cx = (c: number, t: number): Tuple => [CX, c, t, -1];
const ccx = (a: number, b: number, t: number): Tuple => [CCX, a, b, t];
const xg = (q: number): Tuple => [X, q, -1, -1];

// B (m+1 bits) += A (m bits), using m carry qubits that start and end at 0. the gate list undoes itself when reversed, which gives subtraction
export function adderGates(A: number[], B: number[], C: number[]): Tuple[] {
  const m = A.length, out: Tuple[] = [];
  const carry = (ci: number, ai: number, bi: number, co: number): Tuple[] => [ccx(ai, bi, co), cx(ai, bi), ccx(ci, bi, co)];
  const sum = (ci: number, ai: number, bi: number): Tuple[] => [cx(ai, bi), cx(ci, bi)];
  for (let i = 0; i < m; i++) out.push(...carry(C[i]!, A[i]!, B[i]!, i < m - 1 ? C[i + 1]! : B[m]!));
  out.push(cx(A[m - 1]!, B[m - 1]!), ...sum(C[m - 1]!, A[m - 1]!, B[m - 1]!));
  for (let i = m - 2; i >= 0; i--) out.push(...carry(C[i]!, A[i]!, B[i]!, C[i + 1]!).reverse(), ...sum(C[i]!, A[i]!, B[i]!));
  return out;
}

class Builder {
  gates: Tuple[] = [];
  readonly N: number; readonly n: number; readonly L: Layout;
  constructor(N: number, n: number, L: Layout) { this.N = N; this.n = n; this.L = L; }
  push(...g: Tuple[]): void { for (const x of g) this.gates.push(x); }

  // put the constant k into the cr register (or take it out again, it is the same gates). with a control, only when the control is 1
  loadConstant(k: number, control: number | null): void {
    for (let i = 0; i < this.n; i++) if ((k >> i) & 1) this.push(control === null ? xg(this.L.cr[i]!) : cx(control, this.L.cr[i]!));
  }
  private add(subtract: boolean): void {
    const g = adderGates(this.L.cr, this.L.out, this.L.carry);
    this.push(...(subtract ? g.reverse() : g));
  }
  // out = (out + k) mod N, only when `control` is 1 (out must be below N). the flag and the carries start and end at 0
  modAddConstant(k: number, control: number): void {
    const { L, N } = this;
    k = ((k % N) + N) % N;
    if (k === 0) return;
    const top = L.out[this.n]!;
    this.loadConstant(k, control); this.add(false); this.loadConstant(k, control);   // out += k
    this.loadConstant(N, null); this.add(true); this.loadConstant(N, null);         // out -= N (the top bit says it went negative)
    this.push(cx(top, L.flag));
    this.loadConstant(N, L.flag); this.add(false); this.loadConstant(N, L.flag);    // add N back if it went negative
    this.loadConstant(k, control); this.add(true); this.loadConstant(k, control);   // out -= k, to see if we reduced
    this.push(xg(top), cx(top, L.flag), xg(top));                                   // clear the flag
    this.loadConstant(k, control); this.add(false); this.loadConstant(k, control);  // out += k again
  }
  // for each bit of x: when counting qubit `ctl` and that bit are both 1, add the constant (m * 2^i) mod N to out
  private addProducts(ctl: number, multiplier: number): void {
    for (let i = 0; i < this.n; i++) {
      const xi = this.L.x[i]!;
      this.push(ccx(ctl, xi, this.L.and));
      this.modAddConstant((multiplier * Math.pow(2, i)) % this.N, this.L.and);
      this.push(ccx(ctl, xi, this.L.and));
    }
  }
  // x = c * x mod N when the counting qubit is 1, otherwise nothing changes
  controlledMultiply(ctl: number, c: number): void {
    const { L, N } = this;
    const cInverse = S.modInverse(c, N);
    if (cInverse === null) throw new Error('a must have no factor in common with N');
    this.addProducts(ctl, c);
    for (let i = 0; i < this.n; i++) this.push(cx(L.out[i]!, L.x[i]!), ccx(ctl, L.x[i]!, L.out[i]!), cx(L.out[i]!, L.x[i]!)); // controlled swap
    const negative = N - cInverse; // adding this is subtracting c^-1
    this.addProducts(ctl, negative);
  }
}

export function buildModExp(a: number, N: number, t: number): ModExpCircuit {
  const n = S.bitLength(N);
  if (S.gcd(a, N) !== 1) throw new Error('a must have no factor in common with N');
  const L = makeLayout(t, n);
  const b = new Builder(N, n, L);
  for (const q of L.cnt) b.push([H, q, -1, -1]);
  b.push(xg(L.x[0]!)); // the work register starts at 1
  let c = a % N;
  for (let j = 0; j < t; j++) { b.controlledMultiply(L.cnt[j]!, c); c = (c * c) % N; } // c = a^(2^j) mod N

  const size = b.gates.length;
  const op = new Uint8Array(size), q0 = new Int32Array(size), q1 = new Int32Array(size), q2 = new Int32Array(size);
  const counts: GateCounts = { qubits: L.total, hadamards: 0, oneQubit: 0, cnot: 0, toffoli: 0, twoQubitEquivalent: 0, total: size };
  b.gates.forEach((g, i) => {
    op[i] = g[0]; q0[i] = g[1]; q1[i] = g[2]; q2[i] = g[3];
    if (g[0] === H) counts.hadamards++; else if (g[0] === X) counts.oneQubit++; else if (g[0] === CX) counts.cnot++; else counts.toffoli++;
  });
  counts.twoQubitEquivalent = counts.cnot + TOFFOLI_COST * counts.toffoli;
  return { N, a, t, n, layout: L, op, q0, q1, q2, counts };
}

// run the gates on one plain bit string (no superposition): used to check the circuit does the arithmetic it should
export function evalClassical(circ: ModExpCircuit, bits: Uint8Array): void {
  for (let i = 0; i < circ.op.length; i++) {
    const o = circ.op[i]!;
    if (o === X) bits[circ.q0[i]!] ^= 1;
    else if (o === CX) bits[circ.q1[i]!] ^= bits[circ.q0[i]!]!;
    else if (o === CCX) bits[circ.q2[i]!] ^= bits[circ.q0[i]!]! & bits[circ.q1[i]!]!;
  }
}

// ---- simulating it ----

// the chance each gate fails: a toffoli is about 6 two-qubit gates, so it fails like 6 of them
export const gateFailChance = (o: Op, noise: NoiseSettings | null | undefined): number =>
  S.failChance(noise, o === CCX ? TOFFOLI_COST : o === CX ? 1 : 0);

export interface ModExpOutcome {
  y0: number;            // the value measured on the x register (the "target")
  members: Int32Array;   // the counting values that are still in the superposition after that measurement
  signs: Int8Array;      // +1 or -1 for each of them (errors can flip the sign)
  gateErrors: number;
  clean: boolean;        // the work qubits other than x all read 0, as they should
}

// run the whole modexp circuit on every counting value at once, with errors, then measure all the work qubits
export function simulateModExp(circ: ModExpCircuit, rng: Rng, noise: NoiseSettings | null | undefined): ModExpOutcome {
  const { t, layout: L } = circ, count = 1 << t, words = Math.ceil(count / 32);
  const plane: Int32Array[] = Array.from({ length: L.total }, () => new Int32Array(words));
  const sign = new Int32Array(words);
  for (let j = 0; j < t; j++) { // the counting qubits start as "every value": qubit j is 1 where bit j of the value is 1
    const p = plane[L.cnt[j]!]!;
    for (let s = 0; s < count; s++) if ((s >> j) & 1) p[s >> 5] |= 1 << (s & 31);
  }

  const p1 = gateFailChance(X, noise), p2 = gateFailChance(CX, noise), p3 = gateFailChance(CCX, noise);
  const noisy = p1 > 0 || p2 > 0;
  let gateErrors = 0;
  const qubits = [0, 0, 0];
  const flip = (p: Int32Array): void => { for (let w = 0; w < words; w++) p[w] = ~p[w]!; };
  const applyError = (size: number, a: number, b: number, c: number): void => {
    qubits[0] = a; qubits[1] = b; qubits[2] = c;
    let code = 1 + Math.floor(rng() * (Math.pow(4, size) - 1)); // never "no error"
    for (let k = 0; k < size; k++, code >>= 2) {
      const kind = code & 3, p = plane[qubits[k]!]!;
      if (kind === 2 || kind === 3) for (let w = 0; w < words; w++) sign[w] ^= p[w]!; // Y = Z then X (up to a phase nobody can measure)
      if (kind === 1 || kind === 2) flip(p);
    }
    gateErrors++;
  };

  const { op, q0, q1, q2 } = circ;
  for (let i = 0; i < op.length; i++) {
    const o = op[i]!;
    if (o === X) flip(plane[q0[i]!]!);
    else if (o === CX) { const c = plane[q0[i]!]!, tg = plane[q1[i]!]!; for (let w = 0; w < words; w++) tg[w] ^= c[w]!; }
    else if (o === CCX) { const a = plane[q0[i]!]!, b = plane[q1[i]!]!, tg = plane[q2[i]!]!; for (let w = 0; w < words; w++) tg[w] ^= a[w]! & b[w]!; }
    if (!noisy) continue;
    const p = o === H || o === X ? p1 : o === CX ? p2 : p3;
    if (p > 0 && rng() < p) applyError(o === CCX ? 3 : o === CX ? 2 : 1, q0[i]!, q1[i]!, q2[i]!);
  }

  // measure every work qubit: pick a random counting value, and keep the ones whose work qubits agree with it
  const pick = Math.floor(rng() * count);
  const match = new Int32Array(words).fill(-1);
  const bitOf = (q: number, s: number): number => (plane[q]![s >> 5]! >>> (s & 31)) & 1;
  let clean = true;
  for (let q = t; q < L.total; q++) {
    const want = bitOf(q, pick), p = plane[q]!;
    for (let w = 0; w < words; w++) match[w] &= want ? p[w]! : ~p[w]!;
    if (!L.x.includes(q) && want) clean = false;
  }
  let y0 = 0;
  L.x.forEach((q, i) => { y0 |= bitOf(q, pick) << i; });
  const members: number[] = [], signs: number[] = [];
  for (let s = 0; s < count; s++) {
    if (!((match[s >> 5]! >>> (s & 31)) & 1)) continue;
    members.push(s); signs.push(((sign[s >> 5]! >>> (s & 31)) & 1) ? -1 : 1);
  }
  return { y0, members: Int32Array.from(members), signs: Int8Array.from(signs), gateErrors, clean };
}

// one full run: modexp gate by gate, measure the work qubits, qft with errors, measure the counting register, readout errors.
// it has the same shape as runShot in shor-core, so the page can swap one for the other
export function runFullShot(circ: ModExpCircuit, rng: Rng, noise?: NoiseSettings | null): Shot {
  const run = simulateModExp(circ, rng, noise);
  const s = S.makeState(circ.t), amp = 1 / Math.sqrt(run.members.length);
  run.members.forEach((x, i) => { s.re[x] = run.signs[i]! * amp; });
  const failed = S.drawGateErrors(S.qftGates(circ.t), noise, rng);
  if (failed) S.applyNoisyQFT(s, failed, rng); else S.applyQFT(s);
  const probs = S.probabilities(s);
  const kGate = S.sampleFrom(probs, rng);
  const gateErrors = run.gateErrors + (failed ? failed.filter(Boolean).length : 0);
  return { y0: run.y0, k: S.applyNoise(kGate, circ.t, noise, rng), gateErrors };
}
