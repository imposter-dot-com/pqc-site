// how often one shot gives a valid loop length r with this noise. the tests use it to check that noise lowers the success rate
import * as S from '../src/lib/shor/shor-core.ts';

export function successRate(N: number, a: number, noise: S.NoiseSettings, trials: number, rng: S.Rng): number {
  const analysis = S.analyze(a, N, 2 * S.bitLength(N));
  let valid = 0;
  for (let i = 0; i < trials; i++) {
    const shot = S.runShot(analysis, rng, noise);
    if (S.orderFromMeasurement(shot.k, analysis.Q, a, N).r) valid++;
  }
  return valid / trials;
}
