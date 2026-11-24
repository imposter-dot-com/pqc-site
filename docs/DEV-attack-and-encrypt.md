# Dev doc: Attack demo and Encrypt page

The three pages must not repeat each other. The rule is one idea per page:

| Page | Question it answers | Owns |
|---|---|---|
| `/simulator` | **How** does Shor's algorithm break RSA? | The quantum circuit, QFT peaks, continued fractions, noise. All Shor visuals live here and only here. |
| `/attack` | **What does that mean** for data sent today? | The "harvest now, decrypt later" story and the RSA vs. hybrid comparison. |
| `/encrypt` | **How do I protect** a file? | The hybrid X25519 + ML-KEM-768 file format and the real encrypt/decrypt flow. |

Suggested learning order: simulator (the threat works) → attack (why it matters now) → encrypt (the fix).

---

## 1. Attack demo (`/attack`)

**Files:** `src/components/Attack.svelte`, `src/pages/attack.astro`.
Uses `src/lib/shor-core.ts` (toy RSA and `shor()`), `src/lib/hybrid.ts` and `src/lib/suite.ts` (hybrid key setup).

### Purpose
Show the *consequence* of Shor, not the mechanism. One piece of data goes through two attacks, one after the other:
- **Alice** sends it, **Bob** receives it, and **Eve** records it now and attacks it years later.
- **Act 1** protects it with RSA, and Shor breaks it.
- **Act 2** protects the same data with the hybrid (X25519 + ML-KEM), and Shor fails.

### The flow (implemented)
The page is a step-by-step walkthrough. One "Next step" button moves through nine steps, and each finished step keeps its result on screen.

**Input:** a text message or a file (use cases: chat messages and file transfer), plus one of three toy RSA keys. The inputs lock once the walkthrough starts, and "Start over" resets everything.

**Act 1: today, protected by RSA**
1. Encrypt the data with AES-256-GCM (random key).
2. Lock the AES key with Bob's toy RSA key (byte by byte, N = 391, 437 or 481).
3. Eve records the encrypted data and the locked key.
4. Years later, Eve runs Shor on N. `S.shor(N)` gives `p, q`, then `d`. If Shor is unlucky, the step shows "Try again".
5. Eve unlocks the AES key and decrypts. A "What Eve reads" box shows the text, or for a file its size and SHA-256 plus a download link.

**Act 2: the fix, protected by the hybrid**
6. Encrypt the same data again. The AES-256-GCM key now comes from X25519 + ML-KEM-768 (`establish`, `sealWithKey`).
7. Eve records it.
8. Eve runs Shor again. It breaks X25519, but ML-KEM has no loop for Shor to find. The demo hands Eve the X25519 secret, because the toy simulator can't break a real curve.
9. Eve tries to decrypt with the X25519 secret and a guessed ML-KEM secret. AES-GCM rejects the key, and "What Eve reads" shows nothing.

A summary panel at the end links to `/simulator` and `/encrypt`.

### Boundaries
- No qubit counts, no noise sliders, no QFT. Those belong to the simulator. Step 4 only shows the result of Shor.
- No byte-level header display and no key-generation screens. The real file tool is `/encrypt`.
- The hybrid half is an illustration, not a proof that ML-KEM is unbreakable. Keep that sentence in the UI.

### Implementation notes
- All the logic is in `Attack.svelte`. Each step is a function that returns an `Out` (a note, a diagram and an optional "reads" box). The `STEPS` list ties each function to its title and text.
- Every step shows a small diagram built from the real numbers of that run (the AES key and tag, the RSA maths byte by byte, p × q → φ → d, the mixed hybrid key, and so on). The types are in `src/lib/attack-viz.ts` and `src/components/AttackViz.svelte` draws them. To add a diagram, add a `kind` to the `Viz` type and a branch in `AttackViz.svelte`.
- `w` holds what later steps need (the AES key, the locked key, `d`, the hybrid file). It resets with "Start over".
- A text message is up to 60 characters and is encrypted as UTF-8 bytes. A file is read in the browser and never uploaded.
- The RSA side is a toy: each byte of the 32-byte AES key (0 to 255) is encrypted on its own. That only works because N is bigger than 255 (`PQ` in `Attack.svelte`: 17×23, 19×23, 13×37).
- Shor runs with `maxTries: 12`. For these three keys it factored N in 5 out of 5 test runs, in well under a second.

---

## 2. Encrypt a file (`/encrypt`)

**Files:** `src/components/Encrypt.svelte`, `src/pages/encrypt.astro`.
Uses `src/lib/hybrid.ts` (protocol and file format), `src/lib/suite.ts` (noble libraries), `src/lib/bytes.ts`.

### Purpose
A real, usable tool: encrypt and decrypt an actual file in the browser with a hybrid key. It is the *solution* page. It does not attack anything.

### Flow
1. **Create keys:** `generateReceiverKeys(realSuite)` makes an X25519 pair and an ML-KEM-768 pair. Public bundle = `pkM (1184 B) + pkX (32 B)`.
2. **Encrypt:** `encryptFile` runs `establish` (ML-KEM encapsulation + ephemeral X25519) and `deriveFileKey` (HKDF-SHA256 over both shared secrets and the transcript). It then seals with AES-256-GCM, with the header as additional authenticated data.
3. **Decrypt:** `decryptFile` recovers both secrets, re-derives the key and opens the file. A "change one bit" button shows that tampering is rejected.

### File format (`.pqenc`)
`PQE1` magic + version → ML-KEM ciphertext length → ML-KEM ciphertext (1088 B) → ephemeral X25519 public key (32 B) → 12-byte nonce → AES-GCM ciphertext + tag. Parsed by `parseFile`.

### Boundaries
- No Eve, no Shor, no RSA. If a change needs an attacker, it belongs in `/attack`.
- Keys live only in page memory. Nothing is uploaded or stored.
- It does not authenticate the sender, and the prototype is not audited. Keep both disclaimers visible.

### Implementation notes
- `maxBar = 1216` in `Encrypt.svelte` is the hybrid public bundle size (32 + 1184). Update it if the suite changes.
- Steps are reported through the `StepLog` callback, which feeds the timing cards.

---

## 3. Simulator (for context)

The simulator page owns everything about how Shor works, so none of it is repeated above.

- `src/lib/shor-core.ts`: the engine (state vector, QFT, continued fractions, toy RSA).
- `src/lib/simulator.ts`: the page logic. It runs Shor and fills in the page.
- `src/lib/charts.ts`: the bar chart and the noise-sweep line chart, drawn with Chart.js. Three small extras are our own: numbers on top of the bars, brackets, and dashed spike lines.
- `src/lib/circuit.ts`: the circuit drawing (qiskit style), returned as an SVG string.
- `src/components/Simulator.svelte`: the layout, the step-by-step guide and the "How does this break RSA?" explainer.

The guide has 8 steps and only the numbered panels (1 to 5) belong to the break itself. Setup panels are not numbered.

## 4. Testing

```
npm test            # shor-core and hybrid protocol (stand-in KEM, Node's X25519)
npm run test:real   # same protocol with the real ML-KEM-768 + X25519
npm run check       # type check (.ts, .svelte, .astro)
```

Run on Node 22.18+ (see `.nvmrc`); the tests run `.ts` files directly.

## 5. Checklist before adding a feature

- Does it explain *how Shor works*? → `/simulator`.
- Does it show *why waiting is dangerous* or compare RSA with hybrid? → `/attack`.
- Does it *protect real data*? → `/encrypt`.
- Does it already exist on another page? Link to that page instead of copying it.
