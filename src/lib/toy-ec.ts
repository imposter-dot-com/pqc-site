// a tiny elliptic curve, used as a stand-in for x25519 in the attack demo.
//
// real x25519 uses a curve with about 2^255 points, which no simulator can attack.
// this curve has only 229 points, so our simulated quantum computer can really break it,
// the same way the toy rsa key in the demo is a stand-in for rsa-2048.
// the maths is exactly the same as x25519 (a secret number times a public point), just small.
import { randomBytes } from './bytes.ts';
import type { Dh } from './hybrid.ts';

export interface Point { x: number; y: number }
export type Pt = Point | null; // null is the "point at infinity", the zero of the group

// y^2 = x^3 + 3x + 5 over the numbers mod 223. it has 229 points (a prime), so every point except
// the point at infinity generates the whole group
export const CURVE = { p: 223, a: 3, b: 5, n: 229 };

// a small number mod m, never negative
const mod = (a: number, m: number): number => ((a % m) + m) % m;

// the inverse of a mod m (the number that multiplies with a to give 1). m is prime here
export function inverse(a: number, m: number): number {
  let [r0, r1] = [mod(a, m), m];
  let [s0, s1] = [1, 0];
  while (r1 !== 0) {
    const q = Math.floor(r0 / r1);
    [r0, r1] = [r1, r0 - q * r1];
    [s0, s1] = [s1, s0 - q * s1];
  }
  if (r0 !== 1) throw new Error('no inverse');
  return mod(s0, m);
}

export function onCurve(P: Pt): boolean {
  if (!P) return true;
  const { p, a, b } = CURVE;
  return mod(P.y * P.y - (P.x ** 3 + a * P.x + b), p) === 0;
}

export function neg(P: Pt): Pt {
  return P ? { x: P.x, y: mod(-P.y, CURVE.p) } : null;
}

export function add(P: Pt, Q: Pt): Pt {
  if (!P) return Q;
  if (!Q) return P;
  const { p, a } = CURVE;
  if (P.x === Q.x && mod(P.y + Q.y, p) === 0) return null; // P + (-P) = zero
  const slope = P.x === Q.x && P.y === Q.y
    ? mod((3 * P.x * P.x + a) * inverse(2 * P.y, p), p)   // doubling a point
    : mod((Q.y - P.y) * inverse(Q.x - P.x, p), p);        // adding two different points
  const x = mod(slope * slope - P.x - Q.x, p);
  return { x, y: mod(slope * (P.x - x) - P.y, p) };
}

// k * P, by adding P to itself k times (using doubling to be quick)
export function mul(k: number, P: Pt): Pt {
  let result: Pt = null;
  let addend = P;
  let n = mod(k, CURVE.n);
  while (n > 0) {
    if (n & 1) result = add(result, addend);
    addend = add(addend, addend);
    n >>= 1;
  }
  return result;
}

export const samePoint = (P: Pt, Q: Pt): boolean => (!P || !Q ? P === Q : P.x === Q.x && P.y === Q.y);

// the starting point everyone agrees on: the first point we find on the curve
function findGenerator(): Point {
  for (let x = 0; x < CURVE.p; x++) {
    for (let y = 0; y < CURVE.p; y++) {
      const point = { x, y };
      if (onCurve(point)) return point;
    }
  }
  throw new Error('no points on the curve');
}
export const G: Point = findGenerator();

// ---- plugging the toy curve into the hybrid protocol ----
// the hybrid code expects 32-byte public keys (like x25519), so the point is written in 4 bytes and padded with zeros

export function encodePoint(P: Point): Uint8Array {
  const out = new Uint8Array(32);
  out[0] = P.x >> 8; out[1] = P.x & 255; out[2] = P.y >> 8; out[3] = P.y & 255;
  return out;
}

export function decodePoint(bytes: Uint8Array): Point {
  const P = { x: (bytes[0]! << 8) | bytes[1]!, y: (bytes[2]! << 8) | bytes[3]! };
  if (!onCurve(P)) throw new Error('not a point on the toy curve');
  return P;
}

export const encodeSecret = (k: number): Uint8Array => new Uint8Array([k >> 8, k & 255]);
export const decodeSecret = (bytes: Uint8Array): number => (bytes[0]! << 8) | bytes[1]!;

// like x25519: a secret number k, a public point k*G, and a shared secret made from k * (the other side's point)
export const toyDh: Dh = {
  keygen() {
    const bytes = randomBytes(4);
    const k = 1 + (((bytes[0]! << 24) | (bytes[1]! << 16) | (bytes[2]! << 8) | bytes[3]!) >>> 0) % (CURVE.n - 1);
    return { secretKey: encodeSecret(k), publicKey: encodePoint(mul(k, G) as Point) };
  },
  async sharedSecret(secretKey, publicKey) {
    const shared = mul(decodeSecret(secretKey), decodePoint(publicKey));
    if (!shared) throw new Error('shared point is zero');
    // hash the shared point into 32 bytes, so it looks like a normal secret
    const digest = await crypto.subtle.digest('SHA-256', new Uint8Array([shared.x >> 8, shared.x & 255, shared.y >> 8, shared.y & 255]));
    return new Uint8Array(digest);
  },
};
