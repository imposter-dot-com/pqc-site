// run with: node test/toy-ec.test.ts (node 22.18+ runs typescript directly)
// tests the toy elliptic curve, the simulated shor attack on it, and the "does shor find a loop" experiment
import * as S from '../src/lib/shor-core.ts';
import * as EC from '../src/lib/toy-ec.ts';
import { shorDiscreteLog } from '../src/lib/shor-ecdlp.ts';
import { periodExperiment, scrambledFunction } from '../src/lib/shor-period.ts';
import { establish, recover } from '../src/lib/hybrid.ts';
import { realSuite } from '../src/lib/suite.ts';
import { equalBytes } from '../src/lib/bytes.ts';

let pass = 0, fail = 0;
function check(name: string, cond: boolean, extra?: unknown): void { if (cond) { pass++; console.log('PASS', name); } else { fail++; console.log('FAIL', name, extra || ''); } }
const { n, p } = EC.CURVE;

// 1. the curve is what we say it is
{
  let count = 1; // the point at infinity
  for (let x = 0; x < p; x++) for (let y = 0; y < p; y++) if (EC.onCurve({ x, y })) count++;
  check('the curve really has n points (counted one by one)', count === n, count);
  check('n is prime', S.isPrime(n));
  check('the generator is on the curve', EC.onCurve(EC.G));
  check('n * G is the point at infinity', EC.mul(n, EC.G) === null);
  check('(n - 1) * G is -G', EC.samePoint(EC.mul(n - 1, EC.G), EC.neg(EC.G)));
  const rng = S.makeRng(5); let ok = true;
  for (let i = 0; i < 40; i++) {
    const a = 1 + Math.floor(rng() * (n - 1)), b = 1 + Math.floor(rng() * (n - 1));
    if (!EC.samePoint(EC.mul(a + b, EC.G), EC.add(EC.mul(a, EC.G), EC.mul(b, EC.G)))) ok = false;
  }
  check('(a + b) * G = a * G + b * G', ok);
}

// 2. the toy diffie-hellman works like x25519: both sides get the same secret
{
  const alice = await EC.toyDh.keygen(), bob = await EC.toyDh.keygen();
  const s1 = await EC.toyDh.sharedSecret(alice.secretKey, bob.publicKey);
  const s2 = await EC.toyDh.sharedSecret(bob.secretKey, alice.publicKey);
  check('toy diffie-hellman: both sides get the same 32-byte secret', equalBytes(s1, s2) && s1.length === 32);
  check('toy public keys are 32 bytes, like x25519', alice.publicKey.length === 32);
}

// 3. the toy curve plugs into the real hybrid protocol (with the real ml-kem)
{
  const suite = { kem: realSuite.kem, dh: EC.toyDh };
  const m = await suite.kem.keygen(), x = await suite.dh.keygen();
  const keys = { pkM: m.publicKey, skM: m.secretKey, pkX: x.publicKey, skX: x.secretKey };
  const est = await establish(suite, keys);
  const back = await recover(suite, keys, est.ctM, est.ephPub);
  check('hybrid protocol with toy curve + real ml-kem-768: receiver rebuilds the same key', equalBytes(est.key, back));
}

// 4. shor's discrete log recovers the secret, from the public points only
{
  const rng = S.makeRng(11); let found = 0;
  const trials = 25;
  for (let i = 0; i < trials; i++) {
    const k = 1 + Math.floor(rng() * (n - 1));
    const run = shorDiscreteLog(EC.G, EC.mul(k, EC.G) as EC.Point, { rng });
    if (run.k === k) found++;
  }
  check(`simulated shor recovers the secret scalar (${found}/${trials})`, found === trials);
}

// 5. the measured (u, v) follow the maths: v = k * u (mod r) every time
{
  const k = 77, rng = S.makeRng(3);
  const run = shorDiscreteLog(EC.G, EC.mul(k, EC.G) as EC.Point, { rng, maxShots: 40, stopEarly: false });
  const allOnLine = run.shots.every(s => s.v === (k * s.u) % run.r);
  check('every measured (u, v) satisfies v = k * u (mod r)', run.shots.length === 40 && allOnLine);
  check('shots with u = 0 give no secret, others do', run.shots.every(s => (s.u === 0) === (s.k === null)));
}

// 6. shor finds a period in a^x mod N, and finds nothing in a scrambled function
{
  const N = 391, t = 2 * S.bitLength(N);
  let a = 2; while (S.gcd(a, N) !== 1 || (S.classicalOrder(a, N) ?? 0) < 3) a++;
  const withLoop = periodExperiment(x => S.modPow(a, x, N), t, 20, S.makeRng(21));
  const noLoop = periodExperiment(scrambledFunction(0xC0FFEE), t, 40, S.makeRng(22));
  check(`function with a hidden loop: most shots give a valid period (${withLoop.valid}/20)`, withLoop.valid >= 10);
  check('scrambled function: no shot gives a valid period (0/40)', noLoop.valid === 0, noLoop.valid);
  const sum = (b: Float64Array): number => b.reduce((u, v) => u + v, 0);
  check('the measurement chances add up to 1', Math.abs(sum(withLoop.blocks) - 1) < 1e-6 && Math.abs(sum(noLoop.blocks) - 1) < 1e-6);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
