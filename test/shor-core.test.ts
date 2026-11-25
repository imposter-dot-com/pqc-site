// run with: node test/shor-core.test.ts (node 22.18+ runs typescript directly)
import * as S from '../src/lib/shor/shor-core.ts';
import { check, done } from './check.ts';
import { successRate } from './rates.ts';

// 1. our qft built from gates matches the textbook definition (a plain dft)
{
  const t = 5, Q = 1 << t, s = S.makeState(t);
  const rng = S.makeRng(1); let norm = 0;
  for (let i = 0; i < Q; i++) { s.re[i] = rng() - 0.5; s.im[i] = rng() - 0.5; norm += s.re[i] ** 2 + s.im[i] ** 2; }
  for (let i = 0; i < Q; i++) { s.re[i] /= Math.sqrt(norm); s.im[i] /= Math.sqrt(norm); }
  const inRe = Float64Array.from(s.re), inIm = Float64Array.from(s.im);
  S.applyQFT(s);
  let maxErr = 0;
  for (let k = 0; k < Q; k++) {
    let r = 0, m = 0;
    for (let x = 0; x < Q; x++) { const ang = 2 * Math.PI * x * k / Q; r += inRe[x] * Math.cos(ang) - inIm[x] * Math.sin(ang); m += inRe[x] * Math.sin(ang) + inIm[x] * Math.cos(ang); }
    r /= Math.sqrt(Q); m /= Math.sqrt(Q);
    maxErr = Math.max(maxErr, Math.abs(r - s.re[k]), Math.abs(m - s.im[k]));
  }
  check('QFT built from gates matches the DFT definition', maxErr < 1e-9, 'maxErr=' + maxErr);
}

// 2. n=15, a=7 has order 4: ideal spikes at k = 0, 64, 128, 192, each with probability 1/4 (q=256)
{
  const an = S.analyze(7, 15, 8);
  check('order of 7 mod 15 is 4', an.trueOrder === 4);
  const first = an.targets[0], p = an.dist(first.xs.length, first.xs);
  const peaks = [0, 64, 128, 192].map(k => p[k]);
  check('N=15 a=7: four peaks of 0.25', peaks.every(v => Math.abs(v - 0.25) < 1e-9), peaks);
  check('probabilities sum to 1', Math.abs(p.reduce((acc: number, v: number) => acc + v, 0) - 1) < 1e-9);
}

// 3. n=21, a=2 (order 6, q=1024): q/r isn't a whole number so the spikes are spread out, but most of the chance should still sit near multiples of q/r
{
  const an = S.analyze(2, 21, 10);
  const first = an.targets[0], p = an.dist(first.xs.length, first.xs);
  let near = 0;
  for (let j = 0; j < 6; j++) { const c = Math.round(j * 1024 / 6); for (let d = -1; d <= 1; d++) near += p[(c + d + 1024) % 1024]; }
  check('N=21 a=2: >70% of probability within 1 of a multiple of Q/r', near > 0.7, near);
  check('classes of equal size share a distribution (at most 2 sizes)', new Set(an.targets.map(c => c.xs.length)).size <= 2);
}

// 4. continued fractions
{
  const o = S.orderFromMeasurement(64, 256, 7, 15);
  check('measurement 64/256 -> r=4', o.r === 4, o);
  const o2 = S.orderFromMeasurement(192, 256, 7, 15);
  check('measurement 192/256 = 3/4 -> r=4', o2.r === 4, o2);
  const o3 = S.orderFromMeasurement(128, 256, 7, 15);
  check('measurement 128/256 = 1/2 -> no valid r (denominator 2 is not an order)', o3.r === null || o3.r === 4, o3); // 1/2 gives d=2, and the multiple 2 -> r=4 is valid too
  const o0 = S.orderFromMeasurement(0, 256, 7, 15);
  check('measurement 0 gives nothing', o0.r === null);
}

// 5. getting the factors from r
{
  const f = S.factorsFromOrder(7, 15, 4);
  check('r=4, a=7, N=15 -> 3 x 5', f.ok && f.p === 3 && f.q === 5, f);
  check('odd r is rejected', !S.factorsFromOrder(4, 21, 3).ok);
  const f2 = S.factorsFromOrder(14, 15, 2);
  check('a^(r/2) = -1 is rejected', !f2.ok, f2);
}

// 6. the full algorithm on a few numbers (seeded)
for (const N of [15, 21, 33, 35, 55, 77, 143, 221, 391]) {
  const rng = S.makeRng(N);
  const res = S.shor(N, { rng, shots: 30 });
  const fx = res.factors, ok = fx.ok && fx.p * fx.q === N && fx.p > 1;
  check('Shor factors N=' + N + (fx.ok ? ' = ' + fx.p + ' x ' + fx.q : ''), ok, res.factors);
}

// 7. toy rsa round trip: the attacker gets d back from the factors and decrypts
{
  const rsa = S.makeRSA(5, 11); // n = 55
  const msg = S.textToNumbers('HELLO');
  const ct = S.rsaEncrypt(msg, rsa.N, rsa.e);
  const res = S.shor(rsa.N, { rng: S.makeRng(7), shots: 30 });
  if (!res.factors.ok) throw new Error('factoring failed');
  const d = S.rsaPrivateFromFactors(res.factors.p, res.factors.q, rsa.e) as number;
  const plain = S.numbersToText(S.rsaDecrypt(ct, rsa.N, d));
  check('attacker decrypts toy RSA message', plain === 'HELLO' && d === rsa.d, { plain, d, real: rsa.d });
}

// 8. readout noise makes single shots fail more often (N = 143: a pure guess rarely works)
{
  const rng = S.makeRng(42);
  const rates = [0, 0.02, 0.1, 0.3].map(readout => successRate(143, 2, { readout }, 600, rng));
  check('readout noise: success falls as noise rises', rates[0]! > rates[2]! && rates[2]! > rates[3]!, rates);
  console.log('   readout 0 / 2 / 10 / 30%:', rates.map(v => v.toFixed(2)).join(' '));
}

// 9. helpers
check('isPrimePower', S.isPrimePower(9) && S.isPrimePower(13) && !S.isPrimePower(15));
check('modInverse', S.modInverse(3, 40) === 27);

done();
