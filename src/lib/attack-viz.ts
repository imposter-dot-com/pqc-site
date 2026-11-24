// the little diagrams in the attack demo. each step gives the page one of these,
// filled in with the real numbers from that run, and AttackViz.svelte draws it.

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
  // step 8: shor can find a loop in x25519 but not in ml-kem
  | { kind: 'shor2' }
  // step 9: eve builds the wrong key, so the tag check fails
  | { kind: 'wrongkey'; real: string; guess: string };
