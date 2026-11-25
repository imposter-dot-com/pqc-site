// run with: node test/modexp.test.ts (node 22.18+ runs typescript directly)
// tests the modular exponentiation built from X, CNOT and Toffoli gates, and its gate-by-gate simulation
import * as S from '../src/lib/shor/shor-core.ts';
import * as M from '../src/lib/shor/modexp.ts';
import { check, done } from './check.ts';


// 1. the ripple-carry adder adds, and its reverse subtracts (all inputs, 3-bit numbers)
{
  const m = 3, A = [0, 1, 2], B = [3, 4, 5, 6], C = [7, 8, 9];
  const gates = M.adderGates(A, B, C);
  let ok = true, back = true;
  const run = (list: typeof gates, bits: Uint8Array) => {
    for (const [o, a, b, c] of list) {
      if (o === M.X) bits[a] ^= 1; else if (o === M.CX) bits[b] ^= bits[a]!; else if (o === M.CCX) bits[c] ^= bits[a]! & bits[b]!;
    }
  };
  for (let a = 0; a < 8; a++) for (let b = 0; b < 8; b++) {
    const bits = new Uint8Array(10);
    for (let i = 0; i < m; i++) { bits[A[i]!] = (a >> i) & 1; bits[B[i]!] = (b >> i) & 1; }
    run(gates, bits);
    let sum = 0; for (let i = 0; i <= m; i++) sum |= bits[B[i]!]! << i;
    if (sum !== a + b || bits[C[0]!] || bits[C[1]!] || bits[C[2]!]) ok = false;
    run([...gates].reverse(), bits);
    let orig = 0; for (let i = 0; i <= m; i++) orig |= bits[B[i]!]! << i;
    if (orig !== b) back = false;
  }
  check('adder: a + b for all 3-bit inputs, carries cleaned up', ok);
  check('adder: the reversed gates undo it', back);
}

// 2. the whole circuit computes a^x mod N for every counting value, and leaves the work qubits clean
for (const [N, a, t] of [[15, 7, 8], [15, 2, 8], [21, 2, 10], [35, 3, 12], [143, 5, 8]] as const) {
  const circ = M.buildModExp(a, N, t), L = circ.layout;
  let ok = true;
  const first = Math.min(1 << t, 256);
  for (let s = 0; s < first; s++) {
    const bits = new Uint8Array(L.total);
    for (let j = 0; j < t; j++) bits[L.cnt[j]!] = (s >> j) & 1;
    M.evalClassical(circ, bits);
    let xv = 0; L.x.forEach((q, i) => { xv |= bits[q]! << i; });
    let rest = 0; for (let q = t; q < L.total; q++) if (!L.x.includes(q)) rest |= bits[q]!;
    for (let j = 0; j < t; j++) if (bits[L.cnt[j]!] !== ((s >> j) & 1)) rest = 1;
    if (xv !== S.modPow(a, s, N) || rest) { ok = false; console.log('  wrong at s =', s, 'got', xv, 'want', S.modPow(a, s, N)); break; }
  }
  check(`modexp circuit: x register = ${a}^s mod ${N}, everything else back to 0 (${first} values, ${circ.counts.qubits} qubits, ${circ.counts.total} gates)`, ok);
}

// 3. the simulator without noise: the measured work register leaves exactly one class of counting values, with equal signs
{
  const circ = M.buildModExp(7, 15, 8), rng = S.makeRng(4);
  const an = S.analyze(7, 15, 8);
  let ok = true;
  for (let i = 0; i < 8; i++) {
    const out = M.simulateModExp(circ, rng, null);
    const cls = an.targets.find(c => c.y === out.y0);
    if (!cls || out.members.length !== cls.xs.length || !cls.xs.every((x, k) => x === out.members[k]) || out.signs.some(v => v !== 1) || !out.clean) ok = false;
  }
  check('simulator, no noise: the state left is exactly the class of x with a^x = y0 (same as analyze)', ok);
}

// 4. noiseless full circuit gives the same measurement spikes as the shortcut: N = 15, a = 7 only ever gives k = 0, 64, 128, 192
{
  const circ = M.buildModExp(7, 15, 8), rng = S.makeRng(8);
  const ks = Array.from({ length: 40 }, () => M.runFullShot(circ, rng, null).k);
  check('full circuit, no noise (N = 15): every shot lands on a spike 0, 64, 128 or 192', ks.every(k => [0, 64, 128, 192].includes(k)), ks);
  check('full circuit, no noise: all four spikes appear', new Set(ks).size === 4, [...new Set(ks)]);
  const res = S.shor(15, { a: 7, rng: S.makeRng(2), shots: 6, shot: (an2, a, r, nz) => M.runFullShot(M.buildModExp(a, 15, an2.t), r, nz) });
  check('full circuit factors 15 end to end', res.factors.ok && res.factors.p === 3 && res.factors.q === 5, res.factors);
}

// 5. N = 21, a = 2 (order 6, t = 10): the full circuit's measurements match the shortcut's distribution closely
{
  const circ = M.buildModExp(2, 21, 10), an = S.analyze(2, 21, 10), rng = S.makeRng(12);
  let nearFull = 0, nearFast = 0; const trials = 150;
  const near = (k: number): boolean => { for (let j = 0; j < 6; j++) { const c = Math.round(j * 1024 / 6); if (Math.abs(k - c) <= 1) return true; } return false; };
  for (let i = 0; i < trials; i++) { if (near(M.runFullShot(circ, rng, null).k)) nearFull++; if (near(S.runShot(an, rng).k)) nearFast++; }
  check('N = 21: full circuit and shortcut both put most shots next to a multiple of Q/r', nearFull / trials > 0.6 && Math.abs(nearFull - nearFast) / trials < 0.15, [nearFull, nearFast]);
}

// 6. noise on every gate of the circuit
{
  const circ = M.buildModExp(7, 15, 8);
  const noise = { gate1: 0.00001, gate2: 0.00003 }; // small, so a decent share of runs has no error at all
  check('gate failure chances: toffoli counts as 6 two-qubit gates', Math.abs(M.gateFailChance(M.CCX, { gate2: 0.01 }) - (1 - 0.99 ** 6)) < 1e-12);
  let expectedClean = 1;
  for (let i = 0; i < circ.op.length; i++) expectedClean *= 1 - M.gateFailChance(circ.op[i]! as M.Op, noise);
  const rng = S.makeRng(21); let clean = 0; const runs = 600;
  for (let i = 0; i < runs; i++) if (M.simulateModExp(circ, rng, noise).gateErrors === 0) clean++;
  check(`fraction of runs with no gate error matches the chance (expected ${expectedClean.toFixed(2)})`, Math.abs(clean / runs - expectedClean) < 0.06, [clean / runs, expectedClean]);

  // errors hurt: 0.3% two-qubit error on N = 15 makes the work register dirty or the answer wrong much more often
  const noisyRng = S.makeRng(33); let onSpike = 0; const shots = 200;
  for (let i = 0; i < shots; i++) if ([0, 64, 128, 192].includes(M.runFullShot(circ, noisyRng, { gate1: 0.0005, gate2: 0.004 }).k)) onSpike++;
  check('with 0.4% two-qubit error, noticeably fewer shots land on a spike', onSpike / shots < 0.85, onSpike / shots);
}

// 7. gate counts grow like n^3 and are reported
{
  const small = M.buildModExp(2, 15, 8).counts, big = M.buildModExp(2, 143, 16).counts;
  check('real counts: N = 15 uses 8 + 4*4 + 3 = 27 qubits', small.qubits === 27, small.qubits);
  check('a bigger N needs far more gates (143 vs 15: more than 8x)', big.twoQubitEquivalent > 8 * small.twoQubitEquivalent, [small.twoQubitEquivalent, big.twoQubitEquivalent]);
  console.log(`      N=15 (t=8): ${small.total} gates, ${small.twoQubitEquivalent} two-qubit equivalents; N=143 (t=16): ${big.total} gates, ${big.twoQubitEquivalent}`);
}

done();
