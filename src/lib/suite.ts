// libraries we use in the browser: ml-kem-768 from noble-post-quantum and x25519 from noble-curves

import { ml_kem768 } from '@noble/post-quantum/ml-kem.js';
import { x25519 } from '@noble/curves/ed25519.js';
import type { Suite } from './hybrid.ts';

export const MLKEM_PUBLIC_LEN = 1184;  // ml-kem-768 public key size (fips 203)
export const MLKEM_CT_LEN = 1088;      // ml-kem-768 ciphertext size (fips 203)

export const realSuite: Suite = {
  kem: {
    keygen: () => { const k = ml_kem768.keygen(); return { publicKey: k.publicKey, secretKey: k.secretKey }; },
    encapsulate: (publicKey) => ml_kem768.encapsulate(publicKey),
    decapsulate: (cipherText, secretKey) => ml_kem768.decapsulate(cipherText, secretKey),
  },
  dh: {
    keygen: () => { const k = x25519.keygen(); return { publicKey: k.publicKey, secretKey: k.secretKey }; },
    sharedSecret: (secretKey, publicKey) => x25519.getSharedSecret(secretKey, publicKey),
  },
};
