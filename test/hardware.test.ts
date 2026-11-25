// run with: node test/hardware.test.ts (node 22.18+ runs typescript directly)
// tests the real-ibm-noise numbers and the rough "what would real hardware do" estimate
import { qftTwoQubitGates, chanceNoError, hardwareEstimate, fullEstimate } from '../src/lib/noise/hardware-estimate.ts';
import { CHIP_CLASSES, classNoise } from '../src/lib/noise/ibm-noise.ts';
import * as S from '../src/lib/shor/shor-core.ts';
import { buildModExp } from '../src/lib/shor/modexp.ts';
import { check, done } from './check.ts';
import { successRate } from './rates.ts';


// 1. counting the two-qubit gates in the qft
check('qft on 2 qubits: 1 controlled-phase (2 gates) + 1 swap (3 gates) = 5', qftTwoQubitGates(2) === 5, qftTwoQubitGates(2));
check('qft on 8 qubits: 28 controlled-phase + 4 swaps = 68', qftTwoQubitGates(8) === 2 * 28 + 3 * 4, qftTwoQubitGates(8));
check('qft on 14 qubits (the N = 65 circuit): 91 controlled-phase + 7 swaps = 203', qftTwoQubitGates(14) === 2 * 91 + 3 * 7, qftTwoQubitGates(14));

// 2. the chance of no error
check('chance of no error: one step at 50% is 0.5', chanceNoError(0.5, 1) === 0.5);
check('chance of no error: no steps means certain', chanceNoError(0.3, 0) === 1);
check('chance of no error: 203 gates at 0.78% is about 20%', Math.abs(chanceNoError(0.0078, 203) - 0.204) < 0.01, chanceNoError(0.0078, 203));

// 3. the ibm numbers make sense
{
  const all = CHIP_CLASSES.flatMap(c => c.machines);
  check('every machine has readout, one-qubit and two-qubit errors between 0 and 5%',
    all.every(m => [m.readout, m.oneQubit, m.twoQubit].every(v => v > 0 && v < 0.05)));
  check('one-qubit gates are much more accurate than two-qubit gates on every machine', all.every(m => m.oneQubit * 5 < m.twoQubit));
  const heron = classNoise(CHIP_CLASSES.find(c => c.id === 'heron')!), eagle = classNoise(CHIP_CLASSES.find(c => c.id === 'eagle')!);
  check('the newer Heron chips are better than Eagle at readout and two-qubit gates', heron.readout < eagle.readout && heron.twoQubit < eagle.twoQubit);
  check('Eagle readout error is about 2%', Math.abs(eagle.readout - 0.0203) < 0.001, eagle.readout);
  check('Heron readout error is about 0.9%', Math.abs(heron.readout - 0.00855) < 0.001, heron.readout);
}

// 4. the estimate
{
  const est = hardwareEstimate(14);
  const heron = est.find(e => e.label.includes('Heron'))!, eagle = est.find(e => e.label.includes('Eagle'))!;
  check('estimate: two chip generations, both using the same 203 gates', est.length === 2 && est.every(e => e.gates === 203));
  check('estimate: all-ok chance is the product of the gate and readout chances', est.every(e => Math.abs(e.allOk - e.gatesOk * e.readoutOk) < 1e-12));
  check('estimate: the newer chip has a better chance than the older one', heron.allOk > eagle.allOk);
  check('estimate: a clean run is far from certain, even for just the qft part (Eagle below 25%)', eagle.allOk < 0.25, eagle.allOk);
  check('estimate: more counting qubits make a clean run less likely', hardwareEstimate(18)[0]!.allOk < hardwareEstimate(8)[0]!.allOk);
}

// 4b. the whole-circuit estimate uses the real gates of the modular exponentiation
{
  const counts = buildModExp(2, 65, 14).counts, whole = fullEstimate(counts, 14), qftOnly = hardwareEstimate(14);
  check('whole circuit: many more two-qubit gates than the qft alone', whole[0]!.twoQubitGates > 50 * qftOnly[0]!.gates, [whole[0]!.twoQubitGates, qftOnly[0]!.gates]);
  check('whole circuit: the chance of a clean run is far below the qft-only chance', whole.every((w, i) => w.allOk < qftOnly[i]!.allOk / 100), whole.map(w => w.allOk));
  check('whole circuit: a Toffoli counts as 6 two-qubit gates', whole[0]!.twoQubitGates === counts.cnot + 6 * counts.toffoli + qftTwoQubitGates(14));
}

// 5. noise on the gates, simulated for real
{
  const t = 10, an = S.analyze(7, 15, t), gates = S.qftGates(t);
  const rngA = S.makeRng(5), rngB = S.makeRng(5);
  const same = Array.from({ length: 30 }, () => S.runShot(an, rngA).k).join() === Array.from({ length: 30 }, () => S.runShot(an, rngB, { gate1: 0, gate2: 0 }).k).join();
  check('zero gate noise gives exactly the same shots as no noise', same);

  const noise = { gate1: 0.0002, gate2: 0.0075 };
  const expectedClean = gates.reduce((p, g) => p * (1 - S.gateErrorChance(g, noise)), 1);
  check('a controlled-phase gate fails like 2 two-qubit gates, a swap like 3',
    Math.abs(S.gateErrorChance({ type: 'CP', c: 0, q: 1, k: 2 }, { gate2: 0.01 }) - (1 - 0.99 ** 2)) < 1e-12 && Math.abs(S.gateErrorChance({ type: 'SWAP', a: 0, b: 1 }, { gate2: 0.01 }) - (1 - 0.99 ** 3)) < 1e-12);
  const rng = S.makeRng(11), runs = 4000;
  let clean = 0;
  for (let i = 0; i < runs; i++) if (S.runShot(an, rng, noise).gateErrors === 0) clean++;
  check('fraction of clean runs matches the chance of no gate error', Math.abs(clean / runs - expectedClean) < 0.03, [clean / runs, expectedClean]);

  // with the same errors on every gate, the simulated clean-run rate also matches the closed form used in the pop-up estimate
  check('qft gate count used by the pop-up equals the simulated gates (2 per phase gate, 3 per swap)',
    gates.reduce((n, g) => n + (g.type === 'CP' ? 2 : g.type === 'SWAP' ? 3 : 0), 0) === qftTwoQubitGates(t));

  // errors hurt (N = 77, a bigger N so random output rarely works by luck): shots that had a gate error land on a valid order less often than clean shots
  const big77 = S.analyze(2, 77, 14), order77 = S.classicalOrder(2, 77), rng2 = S.makeRng(3);
  let okClean = 0, nClean = 0, okErr = 0, nErr = 0;
  for (let i = 0; i < 600; i++) {
    const sh = S.runShot(big77, rng2, { gate2: 0.004, gate1: 0.0002 });
    const good = S.orderFromMeasurement(sh.k, big77.Q, 2, 77).r === order77;
    if (sh.gateErrors === 0) { nClean++; if (good) okClean++; } else { nErr++; if (good) okErr++; }
  }
  check('shots with gate errors succeed less often than clean shots', okErr / nErr < okClean / nClean, [okErr / nErr, okClean / nClean]);

  // more gate noise, fewer working shots. N = 77 is big enough that a random guess rarely works by luck
  // (at N = 21 a random guess works so often that the drop is too small to test reliably)
  const gateRng = S.makeRng(9), clean77 = successRate(77, 2, {}, 120, gateRng), noisy77 = successRate(77, 2, { gate2: 0.03, gate1: 0.001 }, 120, gateRng);
  check('3% two-qubit gate error is clearly worse than none (N = 77)', noisy77 < clean77 - 0.3, [clean77, noisy77]);

  // a state stays normalised after random errors
  const s = S.makeState(6); for (let i = 0; i < 64; i++) s.re[i] = 1 / 8;
  S.applyNoisyQFT(s, S.qftGates(6).map(() => true), S.makeRng(2));
  check('state stays normalised after an error on every gate', Math.abs(S.probabilities(s).reduce((a: number, b: number) => a + b, 0) - 1) < 1e-9);

  // speed at the biggest t the page uses (N up to 511 -> t = 18)
  const big = S.analyze(2, 377, 18), t0 = Date.now(), rng3 = S.makeRng(1);
  for (let i = 0; i < 5; i++) S.runShot(big, rng3, { gate1: 0.00024, gate2: 0.0075 });
  console.log(`      timing: 5 noisy shots at t=18 took ${Date.now() - t0} ms`);
}

done();
