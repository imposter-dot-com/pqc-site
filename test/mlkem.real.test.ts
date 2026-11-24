// run this after npm install: npm run test:real
// checks the real libraries (ml-kem-768 + x25519) through the same protocol code as the other tests.
import * as H from '../src/lib/hybrid.ts';
import { realSuite, MLKEM_PUBLIC_LEN, MLKEM_CT_LEN } from '../src/lib/suite.ts';
import { equalBytes, randomBytes } from '../src/lib/bytes.ts';

let pass = 0, fail = 0;
const check = (n: string, c: boolean, x?: unknown): void => { if (c) { pass++; console.log('PASS', n); } else { fail++; console.log('FAIL', n, x ?? ''); } };

const keys = await H.generateReceiverKeys(realSuite);
check('ML-KEM-768 public key is 1,184 bytes (FIPS 203)', keys.pkM.length === MLKEM_PUBLIC_LEN, keys.pkM.length);
check('public bundle is 1,216 bytes', H.publicBundle(keys).length === 1216);
const enc = await realSuite.kem.encapsulate(keys.pkM);
check('ML-KEM-768 ciphertext is 1,088 bytes (FIPS 203)', enc.cipherText.length === MLKEM_CT_LEN, enc.cipherText.length);
check('shared secret is 32 bytes', enc.sharedSecret.length === 32);
check('decapsulate gives the same shared secret', equalBytes(await realSuite.kem.decapsulate(enc.cipherText, keys.skM), enc.sharedSecret));
const plain = randomBytes(200_000);
const blob = await H.encryptFile(realSuite, keys, plain);
check('round trip with the real libraries', equalBytes(await H.decryptFile(realSuite, keys, blob), plain));
const bad = blob.slice(); bad[bad.length - 3] ^= 1;
let rejected = false; try { await H.decryptFile(realSuite, keys, bad); } catch { rejected = true; }
check('tampered file is rejected', rejected);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
