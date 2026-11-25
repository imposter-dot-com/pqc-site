// run: node test/hybrid.test.ts (node 22.18+). tests the protocol code with a fake kem (not secure) and node's built-in x25519.
// the real ml-kem-768 runs in the browser. check it with npm run test:real.
import { createHash, randomBytes as nodeRandom } from 'node:crypto';
import * as H from '../src/lib/crypto/hybrid.ts';
import { equalBytes, concat, randomBytes } from '../src/lib/crypto/bytes.ts';
import { check, done } from './check.ts';

const sha = (...p: Uint8Array[]): Uint8Array => new Uint8Array(createHash('sha256').update(concat(...p)).digest());
const expand = (seed: Uint8Array, n: number): Uint8Array => { const out = new Uint8Array(n); let i = 0, c = 0; while (i < n) { const h = sha(seed, new Uint8Array([c++])); out.set(h.subarray(0, Math.min(32, n - i)), i); i += 32; } return out; };

// a fake kem with the same sizes as ml-kem-768 (public key 1184, ciphertext 1088, secret 32). only for testing the logic
const mockKem: H.Kem = {
  keygen: () => { const sk = new Uint8Array(nodeRandom(32)); return { secretKey: sk, publicKey: expand(sha(sk), 1184) }; },
  encapsulate: (pk) => { const r = new Uint8Array(nodeRandom(32)); return { cipherText: concat(r, new Uint8Array(1056)), sharedSecret: sha(pk.slice(0, 32), r) }; },
  decapsulate: (ct, sk) => sha(expand(sha(sk), 1184).slice(0, 32), ct.slice(0, 32)),
};
// real x25519 from node's webcrypto (public key as raw bytes, secret kept as pkcs8)
const subtle = globalThis.crypto.subtle;
const dh: H.Dh = {
  keygen: async () => {
    const k = await subtle.generateKey({ name: 'X25519' }, true, ['deriveBits']) as CryptoKeyPair;
    return { publicKey: new Uint8Array(await subtle.exportKey('raw', k.publicKey)), secretKey: new Uint8Array(await subtle.exportKey('pkcs8', k.privateKey)) };
  },
  sharedSecret: async (sk, pk) => {
    const priv = await subtle.importKey('pkcs8', sk as unknown as BufferSource, { name: 'X25519' }, false, ['deriveBits']);
    const pub = await subtle.importKey('raw', pk as unknown as BufferSource, { name: 'X25519' }, false, []);
    return new Uint8Array(await subtle.deriveBits({ name: 'X25519', public: pub }, priv, 256));
  },
};
const suite: H.Suite = { kem: mockKem, dh };

const keys = await H.generateReceiverKeys(suite);
const plain = randomBytes(100_000);

// 1. sizes
{
  const bundle = H.publicBundle(keys);
  check('public key bundle is 1,216 bytes (1,184 + 32)', bundle.length === 1216, bundle.length);
  const back = H.splitBundle(bundle, 1184);
  check('bundle splits back into the two keys', equalBytes(back.pkM, keys.pkM) && equalBytes(back.pkX, keys.pkX));
}
// 2. round trip
const blob = await H.encryptFile(suite, keys, plain);
{
  const out = await H.decryptFile(suite, keys, blob);
  check('round trip: decrypted file equals original', equalBytes(out, plain));
  check('file overhead = header (7 + 1,088 + 32 + 12) + 16-byte tag', blob.length === plain.length + 7 + 1088 + 32 + 12 + 16, blob.length - plain.length);
  const blob2 = await H.encryptFile(suite, keys, plain);
  check('two encryptions of the same file differ (fresh key and nonce)', !equalBytes(blob, blob2));
}
// 3. tampering gets caught: the body, the ml-kem ciphertext, the ephemeral key, the nonce
async function rejects(b: Uint8Array): Promise<boolean> { try { await H.decryptFile(suite, keys, b); return false; } catch { return true; } }
{
  const p = H.parseFile(blob);
  const flip = (i: number): Uint8Array => { const c = blob.slice(); c[i] = c[i]! ^ 1; return c; };
  check('changed file body is rejected', await rejects(flip(p.offsets.body + 5)));
  check('changed tag is rejected', await rejects(flip(blob.length - 1)));
  check('changed ML-KEM ciphertext is rejected', await rejects(flip(p.offsets.ct + 40)));
  check('changed ephemeral X25519 key is rejected', await rejects(flip(p.offsets.eph + 3)));
  check('changed nonce is rejected', await rejects(flip(p.offsets.nonce + 1)));
  check('wrong magic is rejected', await rejects(flip(0)));
}
// 4. wrong receiver keys fail
{
  const other = await H.generateReceiverKeys(suite);
  try { await H.decryptFile(suite, other, blob); check('wrong receiver keys are rejected', false); } catch { check('wrong receiver keys are rejected', true); }
}
// 5. the key depends on both shared secrets, not just one
{
  const est = await H.establish(suite, keys);
  const same = await H.deriveFileKey(est.ssM, est.ssX, est.ctM, est.ephPub, keys.pkX);
  check('key is reproducible from the same inputs', equalBytes(same, est.key));
  const wrongX = await H.deriveFileKey(est.ssM, randomBytes(32), est.ctM, est.ephPub, keys.pkX);
  const wrongM = await H.deriveFileKey(randomBytes(32), est.ssX, est.ctM, est.ephPub, keys.pkX);
  check('wrong X25519 secret gives a different key', !equalBytes(wrongX, est.key));
  check('wrong ML-KEM secret gives a different key', !equalBytes(wrongM, est.key));
  const rec = await H.recover(suite, keys, est.ctM, est.ephPub);
  check('receiver recovers the sender key', equalBytes(rec, est.key));
}
done();
