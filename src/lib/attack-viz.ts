// the little diagrams in the attack demo. each step gives the page one of these,
// filled in with the real numbers from that run, and AttackViz.svelte draws it.

export interface SpectrumPanel {
  title: string;        // what function we gave shor
  caption: string;      // one line about it
  blocks: number[];     // the chance of each measured value, grouped into blocks
  valid: number;        // how many shots led to a valid loop
  shots: number;
  color: string;
}

export type Viz =
  // step 1: data + key go into aes-256-gcm, scrambled data and a tag come out
  | { kind: 'aes'; plain: string; key: string; cipher: string; tag: string }
  // step 2: each byte of the aes key is locked with rsa
  | { kind: 'lock'; pairs: Array<[number, number]>; N: number; e: number }
  // steps 3 and 7: what travels on the wire, and eve copying it
  | { kind: 'record'; items: string[] }
  // step 4: shor splits n, and the private key follows
  | { kind: 'factor'; N: number; p: number; q: number; phi: number; e: number; d: number; qubits: number }
  // step 5: the rsa lock is undone, then aes opens the data
  | { kind: 'unlock'; pairs: Array<[number, number]>; N: number; d: number }
  // step 6: two secrets are mixed into one aes key
  | { kind: 'mix'; keyHex: string; ctM: number }
  // step 8: shor's discrete log breaks the toy elliptic curve
  | {
      kind: 'ecdlp';
      curve: { p: number; a: number; b: number; n: number };
      B: { x: number; y: number };           // bob's public point
      k: number;                             // bob's secret number, found by shor
      shot: { u: number; v: number };        // the measurement that gave it
      shotsUsed: number;
      registerQubits: number;
      pointQubits: number;
      matches: boolean;                      // does the recovered shared secret match alice's?
    }
  // step 9: shor's period finding on a function with a loop, and on one seeded with the ml-kem key
  | { kind: 'spectrum'; max: number; loop: SpectrumPanel; noLoop: SpectrumPanel }
  // step 10: eve builds the wrong key, so the tag check fails (and the control shows why)
  | { kind: 'wrongkey'; real: string; guess: string; controlOk: boolean };
