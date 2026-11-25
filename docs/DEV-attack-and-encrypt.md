# Dev doc: Attack demo and Encrypt page

The three pages must not repeat each other. The rule is one idea per page:

| Page | Question it answers | Owns |
|---|---|---|
| `/simulator` | **How** does Shor's algorithm break RSA? | The quantum circuit, QFT peaks, continued fractions, noise. All Shor visuals live here and only here. |
| `/encrypt` | **How do I protect** a file? | The hybrid X25519 + ML-KEM-768 file format and the real encrypt/decrypt flow. |
| `/attack` | **What does that mean** for data sent today? | The "harvest now, decrypt later" story and the RSA vs. hybrid comparison. |

## What each part is for

Every part of the site has one job. If a part has no job, or repeats another part, remove it. **Every button must show a result that says what it did, and a disabled button must say why.**

**Simulator**

| Part | Objective: what we want them to see |
|---|---|
| Pick an RSA key | What is being attacked, and that RSA locks a **key**, which locks the message |
| Quantum settings | How realistic the run is: ideal versus real IBM noise, and the a^x mod N step computed directly or built from gates |
| Advanced: base a | Why some bases fail |
| Guide | The algorithm in order, with the real numbers of the run |
| 1. Circuit | The four stages of Shor's algorithm |
| 2. Pattern a^x mod N | The hidden loop, which is the core idea |
| 3. Counting register | How the even spacing becomes spikes after the QFT |
| 4. Find the period | How a measurement becomes r, why we repeat shots, and how noise ruins shots (gate errors column) |
| 5. Outcome and summary | The three steps Eve takes (factor N, unlock the key, open the message), and the base a, loop length r and valid shots of the run |
| "How does this break RSA?" | Orientation for a first-time visitor |
| "Toy vs real hardware" | The scale gap to RSA-2048, that real chips cannot run even the QFT cleanly and the whole circuit has about a 0% chance, and the sources |

**Encrypt page**

| Part | Objective |
|---|---|
| Bob creates his keys | The real key sizes and time, and that the cost of the hybrid is size, not time |
| Alice encrypts | What happens step by step, and what travels in the file header |
| Bob decrypts | That the same file comes back (a preview and a download of the decrypted file) |
| Bob changes one bit, then decrypts | That AES-GCM rejects any change |
| Why can't Eve just guess the key? | That Shor has nothing to grab in ML-KEM, and that guessing is hopeless: 2^256 keys, and still 2^128 steps with Grover |
| How the file key is made | That the key depends on both secrets |

**Attack demo:** the consequence of Shor. Act 1 records the data and RSA breaks. Act 2 repeats it with the hybrid: the curve breaks, ML-KEM holds, and the control test shows ML-KEM is the only missing piece.

**Home:** routes to the three pages.

Suggested learning order: simulator (the threat works) → encrypt (what the hybrid is and the fix) → attack (the payoff: the same data is cracked under RSA, then holds under the hybrid).

---

## 1. Encrypt a file (`/encrypt`)

**Files:** `src/components/Encrypt.svelte`, `src/pages/encrypt.astro`.
Uses `src/lib/crypto/hybrid.ts` (protocol and file format), `src/lib/crypto/suite.ts` (noble libraries), `src/lib/crypto/bytes.ts`.

### Purpose
A real, usable tool: encrypt and decrypt an actual file in the browser with a hybrid key. It is the *solution* page. It does not attack anything.

### Flow
1. **Bob creates his keys.** An X25519 pair and an ML-KEM-768 pair. His public keys together are 1,216 bytes (1,184 + 32). (`generateReceiverKeys` in `hybrid.ts`.)
2. **Alice encrypts.** Her browser does an X25519 exchange and an ML-KEM exchange, mixes both results into one key (HKDF-SHA256), and encrypts the file with AES-256-GCM. The file header is protected too, so changing it is caught. (`encryptFile`.)
3. **Bob decrypts.** He repeats both exchanges with his private keys, gets the same key, and opens the file. The "Change one bit" button shows a tampered file being rejected. (`decryptFile`.)

### File format (`.pqenc`)
`PQE1` magic + version → ML-KEM ciphertext length → ML-KEM ciphertext (1088 B) → ephemeral X25519 public key (32 B) → 12-byte nonce → AES-GCM ciphertext + tag. Parsed by `parseFile`.

### Boundaries
- No Eve, no Shor, no RSA. If a change needs an attacker, it belongs in `/attack`.
- Keys live only in page memory. Nothing is uploaded or stored.
- It does not authenticate the sender, and the prototype is not audited. Keep both disclaimers visible.

### Implementation notes
- The four "What happened" cards get their timings from a `StepLog` callback in `hybrid.ts`.

---

## 2. Attack demo (`/attack`)

**Files:** `src/components/Attack.svelte`, `src/pages/attack.astro`.
Uses `src/lib/shor/shor-core.ts` (toy RSA and `shor()`), `src/lib/crypto/hybrid.ts` and `src/lib/crypto/suite.ts` (hybrid key setup).

### Purpose
Show the *consequence* of Shor, not the mechanism. One piece of data goes through two attacks, one after the other:
- **Alice** sends it, **Bob** receives it, and **Eve** records it now and attacks it years later.
- **Act 1** protects it with RSA, and Shor breaks it.
- **Act 2** protects the same data with the hybrid (X25519 + ML-KEM), and Shor fails.

### The flow (implemented)
The page is a step-by-step walkthrough. One "Next step" button moves through ten steps, and each finished step keeps its result on screen.

**Input:** a text message or a file (use cases: chat messages and file transfer), plus one of three toy RSA keys. The inputs lock once the walkthrough starts, and "Start over" resets everything.

**Act 1: today, protected by RSA**
1. Encrypt the data with AES-256-GCM (random key).
2. Lock the AES key with Bob's toy RSA key (byte by byte, N = 391, 437 or 481).
3. Eve records the encrypted data and the locked key.
4. Years later, Eve runs Shor on N. `S.shor(N)` gives `p, q`, then `d`. If Shor is unlucky, the step shows "Try again".
5. Eve unlocks the AES key and decrypts. A "What Eve reads" box shows the text, or for a file its size and SHA-256 plus a download link.

**Act 2: the fix, protected by the hybrid** (a toy elliptic curve standing in for X25519, plus the real ML-KEM-768)

6. **Encrypt the same data again.** This time the AES key is made from two exchanges mixed together: the toy elliptic curve and the real ML-KEM-768.
7. **Eve records it.**
8. **Eve attacks the elliptic-curve half with Shor's discrete-log algorithm.** It only uses public information (Bob's public point), simulates the quantum steps, and recovers Bob's secret number. Eve then works out the shared secret from Alice's public point, and the page checks that it matches Alice's. (Code: `shorDiscreteLog` in `shor-ecdlp.ts`.)
9. **Eve tries the same quantum period finding on two functions.** One has a hidden loop (`aˣ mod N`). The other is scrambled using the real ML-KEM public key, so it has no loop. Both are real simulated runs. The page shows two charts and how many shots found a loop. (Code: `periodExperiment` in `shor-period.ts`.)
10. **Eve tries to decrypt.** She uses the curve secret she recovered and a guess for the ML-KEM secret. AES-GCM rejects the key. A control run with the real ML-KEM secret opens the file, which shows that ML-KEM is the only missing piece.

A summary panel at the end links to `/simulator` and `/encrypt`.

### Boundaries
- No qubit counts, no noise sliders, no QFT. Those belong to the simulator. Step 4 only shows the result of Shor.
- No byte-level header display and no key-generation screens. The real file tool is `/encrypt`.
- The ML-KEM result is a real run but not a proof that ML-KEM is unbreakable. Keep that wording in the UI.
- Nothing is "handed" to Eve. If you add a step, it must either compute its result or say clearly that it is explained, not computed.

### Implementation notes
- **All the logic is in `Attack.svelte`.** Each step is a small function that returns what to show: a short note, a diagram, and sometimes a "What Eve reads" box. The `STEPS` list connects each function to its title and description.
- **Every step has a small diagram** built from the real numbers of that run. The diagram types are in `src/lib/ui/attack-viz.ts`, and `src/components/AttackViz.svelte` draws them. To add one, add a new `kind` in the first file and a matching block in the second.
- **`w` is the page's scratch memory.** It keeps what later steps need (the AES key, the locked key, the private key, the hybrid file). "Start over" clears it.
- **Text** can be up to 60 characters. **A file** is read in the browser and never uploaded.
- **The RSA side is a toy.** The 32-byte AES key is locked one byte at a time, and each byte is a number from 0 to 255. That only works if N is bigger than 255, so the three keys are 17 × 23, 19 × 23 and 13 × 37 (`PQ` in `Attack.svelte`).
- **Shor on the RSA key** tries up to 12 times. With these keys it found the factors every time in 5 test runs, in under a second.
- **The toy curve** is y² = x³ + 3x + 5 over the numbers mod 223, and it has 229 points (a prime). The simulated attack uses an exact Fourier transform with no noise and takes about 0.2 seconds. `test/toy-ec.test.ts` checks the curve, the attack and the loop experiment.
- **The Encrypt page** still uses the real X25519, not the toy curve.

---

## 3. Simulator (for context)

The simulator page owns everything about how Shor works, so none of it is repeated above.

`src/lib` is split by purpose. Imports only go one way: `ui/` uses `noise/` and `shor/`, `noise/` uses `shor/`, and `shor-ecdlp.ts` uses the toy curve in `crypto/`. Nothing in `src/lib` imports from `ui/`:

| Folder | What is in it |
|---|---|
| `shor/` | The algorithm: `shor-core.ts` (engine), `modexp.ts` (gate-level modular exponentiation), `shor-ecdlp.ts` (elliptic-curve discrete log), `shor-period.ts` (loop vs. no loop). |
| `crypto/` | The encryption side: `hybrid.ts`, `suite.ts`, `toy-ec.ts`, `bytes.ts`. |
| `noise/` | Real hardware numbers: `ibm-noise.ts` and `hardware-estimate.ts`. |
| `ui/` | Page logic and drawing: `simulator.ts`, `charts.ts`, `circuit.ts`, `attack-viz.ts`, and nothing about looks (that is in `src/styles/`). |

Shared pieces live in one place on purpose: `sampleFrom`, `failChance` and `twoQubitCost` are in `shor-core.ts` and reused by `modexp.ts`, `shor-ecdlp.ts` and `hardware-estimate.ts`; `check` and `done` for the tests are in `test/check.ts`.

- `src/lib/shor/shor-core.ts`: the engine (state vector, QFT, continued fractions, toy RSA). `analyzeFunction` runs the same period finding on any function, not just `aˣ mod N`.
- `src/lib/crypto/toy-ec.ts`: the toy elliptic curve (229 points) that stands in for X25519 in the attack demo, and a `Dh` object that plugs into the hybrid protocol.
- `src/lib/shor/shor-ecdlp.ts`: Shor's discrete-log algorithm, simulated, used to break the toy curve.
- `src/lib/shor/shor-period.ts`: the loop-versus-no-loop experiment used on the attack page.
- Gate noise lives in `shor-core.ts` (`drawGateErrors`, `applyNoisyQFT`). Each QFT gate can fail; a failed gate gets a random X/Y/Z error on its qubits. If no gate fails in a shot, the cached ideal result is used, so only shots with errors pay for a full re-run.
- `src/lib/shor/modexp.ts`: **Full circuit** mode. It builds |x>|1> -> |x>|a^x mod N> from X, CNOT and Toffoli gates (a ripple-carry adder, controlled modular addition of a constant, controlled multiply, swap, un-multiply), about t + 4n + 3 qubits. It is simulated bit-sliced: one bit per counting value per qubit, so a gate updates 32 counting values per machine word. This is exact because these gates only permute basis states, and a Pauli error is a bit flip (X) or a sign flip (Z). Then the work qubits are measured and the normal QFT runs. A Toffoli fails like 6 two-qubit gates. Speed: about 8 ms per shot at N = 15, 0.5 s at N = 143, 1.8 s at N = 377, so the page only offers it up to N = 143.
- `src/lib/noise/ibm-noise.ts`: real noise numbers (readout, one-qubit and two-qubit gate errors) from IBM's published calibration snapshots, with the steps to check them.
- `src/lib/noise/hardware-estimate.ts`: a rough estimate of the chance that the circuit and the readout would be error-free on a real chip, for the QFT alone and for the whole circuit. It counts the gates from the same circuits the simulator builds.
- `src/lib/ui/simulator.ts`: the page logic. It runs Shor and fills in the page, including the noise presets and the real-hardware table in the pop-up.
- `src/lib/ui/charts.ts`: the bar chart, drawn with Chart.js. Three small extras are our own: numbers on top of the bars, brackets, and dashed spike lines.
- `src/lib/ui/circuit.ts`: the circuit drawing (qiskit style), returned as an SVG string.
- `src/components/Simulator.svelte`: the layout, the step-by-step guide and the "How does this break RSA?" explainer.

The guide has 8 steps and only the numbered panels (1 to 5) belong to the break itself. Setup panels are not numbered.

## 4. Styling (Tailwind)

All styling is Tailwind v4, and every class lives in `src/styles/`, not in the markup.
- `global.css` has the theme (our colours like `bg-panel2`, `text-muted`, `border-line`, the fonts) and a small `@layer base` for plain elements with no class (`button`, `input`, `select`, `label`, `table`). There is no Tailwind reset (preflight), so a bare border needs an explicit width and colour.
- Each page or component has a style file (`simulator.ts`, `attack.ts`, `encrypt.ts`, `home.ts`, `layout.ts`, `attack-viz.ts`), and `shared.ts` holds what several pages use (panels, number tiles, buttons, status colours). Every element has a name and a comment, and the markup reads `class={css.guideBar}`. Code that builds HTML uses the same names, for example `${shared.mono}`.
- Each entry is `tw('layout', 'size and spacing', 'text', 'look', 'states')`: the classes are grouped on separate lines. `tw` only joins them. Prettier (with the Tailwind plugin, see `.prettierrc.json`) sorts the classes inside each line. After editing a style file, run `npm run format:styles`.
- To restyle something, find its name in the markup, then change that entry. Tailwind finds the classes because it scans every source file, including these.
- Sizes are written as `text-[15px]`, not `text-sm`, because the named sizes also set the line height.
- Two classes in one element that set the same property (for example `bg-white` and `bg-warn`) clash, and the one that wins is not the one written last. Pick one per element, or use `!` (`border-accent!`).
- The circuit drawing (`circuit.ts`) is an SVG with its own `<style>` block, so it is not Tailwind.

## 5. Testing

```
npm test            # 26 simulator + 16 hybrid protocol + 15 toy-curve and attack + 26 noise checks + 17 full-circuit checks + 14 style-name checks
npm run test:real   # 7 checks: the same protocol with the real ML-KEM-768 + X25519
npm run check       # strict type check (.ts, .svelte, .astro)
npm run build       # the static site; it makes no network requests, so it works offline
```

- `test/shor-core.test.ts`: the simulator engine (the QFT against the textbook definition, the N = 15 peaks, continued fractions, factoring, noise).
- `test/hybrid.test.ts`: the hybrid protocol with a stand-in KEM (round trip, tampering, wrong keys, the key depends on both secrets).
- `test/toy-ec.test.ts`: the toy curve (point count checked one by one), the simulated discrete-log attack, the loop-versus-no-loop experiment, and the toy curve inside the real hybrid protocol.
- `test/modexp.test.ts`: the adder, the whole circuit against a^s mod N (work qubits back to 0), the noiseless full circuit against the shortcut (N = 15 spikes, N = 21), and the gate-error rates.
- `test/styles.test.ts`: every `css.name` and `shared.name` used in the markup exists in the style files (the type checker does not look inside Svelte templates), and no style is empty.
- `test/hardware.test.ts`: the real IBM noise numbers (they make sense), the gate counting and estimate maths, and the gate-noise simulation (clean-run rate matches the estimate, errors hurt, state stays normalised).
- `test/mlkem.real.test.ts`: the real libraries.

Run on Node 22.18+ (see `.nvmrc`); the tests run `.ts` files directly.

**What is not tested automatically:** the pages themselves. Only the code in `src/lib` has unit tests. The pages were checked by hand and with a headless browser (see section 5).

## 6. What is left to do

The project works from start to finish. This is the list of things we did not get to. They are independent, so you can pick any one. Each item says **what to do**, **why it matters**, and **where to start**.

### Small fixes

- [ ] **Say there is no quantum speed-up on the simulator page.**
  The simulator is a normal computer pretending to be a quantum one, and the page should say so in plain words.
  *Start in:* the subtitle in `src/pages/simulator.astro`.

- [ ] **Soften two sentences that sound like a guarantee.**
  "So it stays safe even against a future quantum computer" (the home page card) and "keeps your data safe" (the first line of the README) promise too much. A safer wording is "designed to resist a future quantum computer; no quantum attack is known."
  *Start in:* `src/pages/index.astro` (line 65) and `README.md` (line 3).

- [ ] **Let people drag and drop a file** instead of only clicking "Choose File".
  *Start in:* `src/components/Encrypt.svelte`. Move the code that reads the file out of the click handler, so a drop can use it too. The attack page has the same file picker.

- [ ] **Let the simulator use N = 15** (3 × 5).
  It is the classic textbook example: with a = 7, the peaks land at k = 0, 64, 128 and 192. The unit test already checks the maths, but the page can't show it, because it rejects N below 27.
  *Start in:* `src/lib/ui/simulator.ts`. Add 3 × 5 to the presets and lower the minimum, then check that the charts look right with 8 counting qubits.

### Bigger additions

- [ ] **Add "What if only one half is broken?" to the Encrypt page.**
  Two buttons: decrypt with a wrong X25519 part, and decrypt with a wrong ML-KEM part. Each one should show that the key comes out different and the file is rejected. A third check with both parts right should open the file. This is the clearest way to show *why* we use a hybrid.
  *Start in:* `src/components/Encrypt.svelte`. The helpers `parseFile`, `deriveFileKey` and `openWithKey` in `src/lib/crypto/hybrid.ts` do the work.

- [ ] **Add a "Decrypt with the wrong keys" button.**
  Make a second set of keys, try to decrypt, and show the rejection message.
  *Start in:* `src/components/Encrypt.svelte`, using `generateReceiverKeys` and `decryptFile`.

- [ ] **Show more sizes next to the key sizes.**
  Right now the chart shows only the public keys. Add the ciphertext sizes (X25519 32 bytes, ML-KEM 1,088 bytes, hybrid 1,120 bytes) and an RSA-2048 comparison (294 bytes for the public key, 256 bytes for the ciphertext). It shows that the hybrid's main cost is size, not speed.
  *Start in:* the size bars in `src/components/Encrypt.svelte`. The bar scale (`maxBar`) must grow to fit the biggest number.

### Checks nobody has done yet

- [ ] **Run the attack demo with a file, not only text.**
  Check that the recovered file's SHA-256 matches the original and the download link works. So far only text has been run all the way through. File mode was checked by reading the code.

- [ ] **Try Firefox and Safari.**
  Everything was tested in Chrome only. The parts most likely to differ are the browser's built-in crypto (AES-GCM and key derivation) and the ML-KEM library.

- [ ] **Add automated page tests.**
  Only the code in `src/lib` has tests. The pages were checked by hand, and some problems (a broken stylesheet, a collapsed chart) were only noticed by looking at screenshots. A small browser-driven test could encrypt, decrypt and tamper on the Encrypt page, run the simulator, and click through every step of the attack page.

### Limits to know about (not bugs)

- **Big files use a lot of memory.** The Encrypt page keeps several copies of the file while it works, about 8 times the file size. A 50 MB file uses about 400 MB. Files much bigger than 200 MB may fail. The fix would be fewer copies, encrypting in chunks, or a size warning.
- **The phone layout has not been checked.** There are layout rules for narrower screens, but nobody has looked at a real phone.
- **The key derivation string is `PQE1 file key`**, and files start with `PQE1`, version 1 (in `src/lib/crypto/hybrid.ts`). If any other document gives a different string, change the document and leave the code alone, unless you also change the file format version.

### Ideas for later

- Show the "pretend ML-KEM is broken" case on the attack page, to match the X25519 case it already breaks for real.
- Encrypt big files in chunks so any size fits.
- Put a built copy of the site online. It is a static site and needs no server.

## 7. Checklist before adding a feature

- Does it explain *how Shor works*? → `/simulator`.
- Does it show *why waiting is dangerous* or compare RSA with hybrid? → `/attack`.
- Does it *protect real data*? → `/encrypt`.
- Does it already exist on another page? Link to that page instead of copying it.
