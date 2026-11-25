// hybrid.ts: mixes two key exchanges (x25519 + ml-kem-768) and uses the result to encrypt files with aes-256-gcm.
//
// the two key exchange parts are passed in as a "suite". that way the same code runs with the real
// libraries in the browser (suite.ts) and with a fake one in the tests (test/hybrid.test.ts).
//
// how the key is made:
//   key = hkdf-sha256(ml-kem secret + x25519 secret + ml-kem ciphertext + ephemeral x25519 key + receiver x25519 key)
// what the file looks like:
//   file = header + aes-256-gcm(key, nonce, data), and the header is checked too
//   header = "PQE1" | version | ml-kem ciphertext length | ml-kem ciphertext | ephemeral x25519 key (32 bytes) | nonce (12 bytes)
import { concat, utf8, randomBytes } from './bytes.ts';

type Maybe<T> = T | Promise<T>;
export interface KeyPair { publicKey: Uint8Array; secretKey: Uint8Array }
export interface Kem {
  keygen(): Maybe<KeyPair>;
  encapsulate(publicKey: Uint8Array): Maybe<{ cipherText: Uint8Array; sharedSecret: Uint8Array }>;
  decapsulate(cipherText: Uint8Array, secretKey: Uint8Array): Maybe<Uint8Array>;
}
export interface Dh {
  keygen(): Maybe<KeyPair>;
  sharedSecret(secretKey: Uint8Array, publicKey: Uint8Array): Maybe<Uint8Array>;
}
export interface Suite { kem: Kem; dh: Dh }

export interface ReceiverKeys { pkM: Uint8Array; skM: Uint8Array; pkX: Uint8Array; skX: Uint8Array }
export interface ReceiverPublic { pkM: Uint8Array; pkX: Uint8Array }
export type StepLog = (step: string, ms: number, bytes?: number) => void;

export const MAGIC = utf8('PQE1');
export const VERSION = 1;
export const NONCE_LEN = 12;
export const X_LEN = 32;
const INFO = utf8('PQE1 file key');

const subtle = (): SubtleCrypto => globalThis.crypto.subtle;
const buf = (b: Uint8Array): BufferSource => b as unknown as BufferSource;

export async function generateReceiverKeys(suite: Suite): Promise<ReceiverKeys> {
  const m = await suite.kem.keygen(), x = await suite.dh.keygen();
  return { pkM: m.publicKey, skM: m.secretKey, pkX: x.publicKey, skX: x.secretKey };
}
// what the receiver publishes: the ml-kem key first, then the x25519 key
export function publicBundle(k: ReceiverPublic): Uint8Array { return concat(k.pkM, k.pkX); }
export function splitBundle(bundle: Uint8Array, mlkemPublicLen: number): ReceiverPublic {
  return { pkM: bundle.slice(0, mlkemPublicLen), pkX: bundle.slice(mlkemPublicLen) };
}

// mix both shared secrets and the whole exchange into one 256-bit key
export async function deriveFileKey(ssM: Uint8Array, ssX: Uint8Array, ctM: Uint8Array, ephPub: Uint8Array, pkX: Uint8Array): Promise<Uint8Array> {
  const ikm = await subtle().importKey('raw', buf(concat(ssM, ssX, ctM, ephPub, pkX)), 'HKDF', false, ['deriveBits']);
  const bits = await subtle().deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: buf(new Uint8Array(0)), info: buf(INFO) }, ikm, 256);
  return new Uint8Array(bits);
}

export interface Established { ctM: Uint8Array; ephPub: Uint8Array; ssM: Uint8Array; ssX: Uint8Array; key: Uint8Array }
// sender: run both key exchanges and make the file key
export async function establish(suite: Suite, to: ReceiverPublic, log?: StepLog): Promise<Established> {
  let t = performance.now();
  const lap = (name: string, bytes?: number): void => { const n = performance.now(); log?.(name, n - t, bytes); t = n; };
  const eph = await suite.dh.keygen();
  const ssX = await suite.dh.sharedSecret(eph.secretKey, to.pkX);
  lap('X25519', eph.publicKey.length);
  const { cipherText: ctM, sharedSecret: ssM } = await suite.kem.encapsulate(to.pkM);
  lap('ML-KEM encapsulate', ctM.length);
  const key = await deriveFileKey(ssM, ssX, ctM, eph.publicKey, to.pkX);
  lap('HKDF-SHA256', key.length);
  return { ctM, ephPub: eph.publicKey, ssM, ssX, key };
}
// receiver: rebuild the same key
export async function recover(suite: Suite, keys: ReceiverKeys, ctM: Uint8Array, ephPub: Uint8Array): Promise<Uint8Array> {
  const ssX = await suite.dh.sharedSecret(keys.skX, ephPub);
  const ssM = await suite.kem.decapsulate(ctM, keys.skM);
  return deriveFileKey(ssM, ssX, ctM, ephPub, keys.pkX);
}

export function buildHeader(ctM: Uint8Array, ephPub: Uint8Array, nonce: Uint8Array): Uint8Array {
  const len = new Uint8Array([ctM.length >> 8, ctM.length & 255]);
  return concat(MAGIC, new Uint8Array([VERSION]), len, ctM, ephPub, nonce);
}
export interface Parsed { header: Uint8Array; ctM: Uint8Array; ephPub: Uint8Array; nonce: Uint8Array; body: Uint8Array; offsets: { ct: number; eph: number; nonce: number; body: number } }
export function parseFile(blob: Uint8Array): Parsed {
  if (blob.length < 7 + X_LEN + NONCE_LEN + 16) throw new Error('file too short');
  for (let i = 0; i < 4; i++) if (blob[i] !== MAGIC[i]) throw new Error('not a PQE1 file');
  if (blob[4] !== VERSION) throw new Error('unsupported version');
  const ctLen = (blob[5]! << 8) | blob[6]!;
  const ct = 7, eph = ct + ctLen, nonce = eph + X_LEN, body = nonce + NONCE_LEN;
  if (blob.length < body + 16) throw new Error('file too short');
  return { header: blob.slice(0, body), ctM: blob.slice(ct, eph), ephPub: blob.slice(eph, nonce), nonce: blob.slice(nonce, body), body: blob.slice(body), offsets: { ct, eph, nonce, body } };
}

async function aesKey(key: Uint8Array, usage: 'encrypt' | 'decrypt'): Promise<CryptoKey> {
  return subtle().importKey('raw', buf(key), 'AES-GCM', false, [usage]);
}
export async function sealWithKey(key: Uint8Array, header: Uint8Array, nonce: Uint8Array, plaintext: Uint8Array): Promise<Uint8Array> {
  const ct = await subtle().encrypt({ name: 'AES-GCM', iv: buf(nonce), additionalData: buf(header), tagLength: 128 }, await aesKey(key, 'encrypt'), buf(plaintext));
  return concat(header, new Uint8Array(ct));
}
export async function openWithKey(key: Uint8Array, p: Parsed): Promise<Uint8Array> {
  const pt = await subtle().decrypt({ name: 'AES-GCM', iv: buf(p.nonce), additionalData: buf(p.header), tagLength: 128 }, await aesKey(key, 'decrypt'), buf(p.body));
  return new Uint8Array(pt);
}

export async function encryptFile(suite: Suite, to: ReceiverPublic, plaintext: Uint8Array, log?: StepLog): Promise<Uint8Array> {
  const est = await establish(suite, to, log);
  const t = performance.now();
  const nonce = randomBytes(NONCE_LEN);
  const out = await sealWithKey(est.key, buildHeader(est.ctM, est.ephPub, nonce), nonce, plaintext);
  log?.('AES-256-GCM encrypt', performance.now() - t, plaintext.length);
  return out;
}
// throws if the file was changed or the keys are wrong (the aes-gcm check fails)
export async function decryptFile(suite: Suite, keys: ReceiverKeys, blob: Uint8Array, log?: StepLog): Promise<Uint8Array> {
  const p = parseFile(blob);
  let t = performance.now();
  const key = await recover(suite, keys, p.ctM, p.ephPub);
  log?.('X25519 + ML-KEM decapsulate + HKDF', performance.now() - t);
  t = performance.now();
  const out = await openWithKey(key, p);
  log?.('AES-256-GCM decrypt', performance.now() - t, out.length);
  return out;
}
