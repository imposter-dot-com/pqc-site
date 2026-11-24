<script lang="ts">
  import { tick } from 'svelte';
  import * as S from '../lib/shor-core.ts';
  import { realSuite } from '../lib/suite.ts';
  import { establish, buildHeader, sealWithKey, openWithKey, parseFile, deriveFileKey, generateReceiverKeys, NONCE_LEN } from '../lib/hybrid.ts';
  import type { ReceiverKeys } from '../lib/hybrid.ts';
  import AttackViz from './AttackViz.svelte';
  import type { Viz } from '../lib/attack-viz.ts';
  import { utf8, randomBytes, toHex, equalBytes } from '../lib/bytes.ts';

  // ---- what alice sends: a text message or a file ----
  let mode = $state<'text' | 'file'>('text');
  let secret = $state('MEET AT NOON');
  let fileName = $state('');
  let fileBytes: Uint8Array | null = null;

  // bob's toy rsa keys: n = 391, 437, 481. all bigger than 255 so one byte of the aes key fits
  const PQ: Array<[number, number]> = [[17, 23], [19, 23], [13, 37]];
  let pq = $state(0);
  const rsa = $derived(S.makeRSA(PQ[pq]![0], PQ[pq]![1]));

  // ---- where we are in the story ----
  let step = $state(0);          // how many steps are done
  let busy = $state(false);
  let url = $state('');          // download link for a file eve recovered

  // what a finished step shows
  interface Out {
    note: string;                                       // what just happened, in plain words
    reads?: { kind: 'bad' | 'ok'; text: string };       // what eve ends up reading
    viz?: Viz;                                          // a small diagram of how the step works
    retry?: boolean;                                    // the step didn't work, so stay on it
  }
  let outs = $state<Out[]>([]);

  // things we need to remember between steps (not shown on the page directly)
  interface Work {
    plain?: Uint8Array;
    aesKey?: Uint8Array; iv?: Uint8Array; ct?: Uint8Array; wrapped?: number[];
    d?: number;
    hyb?: Uint8Array; hybKeys?: ReceiverKeys; ssX?: Uint8Array; pkX?: Uint8Array; realKey?: Uint8Array;
  }
  let w: Work = {};

  const fmt = (n: number): string => n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(2)} MB`;
  const sha = async (b: Uint8Array): Promise<string> => toHex(new Uint8Array(await crypto.subtle.digest('SHA-256', b as unknown as BufferSource))).slice(0, 16);
  const sleep = (ms: number): Promise<void> => new Promise(r => setTimeout(r, ms));
  const canStart = $derived(mode === 'text' ? secret.length > 0 : !!fileName);

  function reset(): void {
    step = 0; outs = []; w = {};
    if (url) { URL.revokeObjectURL(url); url = ''; }
  }
  function setMode(m: 'text' | 'file'): void { mode = m; reset(); }
  async function onFile(ev: Event): Promise<void> {
    const f = (ev.target as HTMLInputElement).files?.[0];
    if (!f) return;
    reset();
    fileName = f.name;
    fileBytes = new Uint8Array(await f.arrayBuffer());
  }

  // ---- aes-256-gcm with the browser's built-in crypto ----
  const importKey = (k: Uint8Array, use: 'encrypt' | 'decrypt') => crypto.subtle.importKey('raw', k as unknown as BufferSource, 'AES-GCM', false, [use]);
  async function aesSeal(k: Uint8Array, data: Uint8Array) {
    const iv = randomBytes(12);
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as unknown as BufferSource }, await importKey(k, 'encrypt'), data as unknown as BufferSource));
    return { iv, ct };
  }
  async function aesOpen(k: Uint8Array, iv: Uint8Array, ct: Uint8Array): Promise<Uint8Array> {
    return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv as unknown as BufferSource }, await importKey(k, 'decrypt'), ct as unknown as BufferSource));
  }

  // ---- act 1: today, with rsa ----

  async function encryptAes(): Promise<Out> {
    w.plain = mode === 'text' ? utf8(secret) : fileBytes!;
    w.aesKey = randomBytes(32);
    const { iv, ct } = await aesSeal(w.aesKey, w.plain);
    w.iv = iv; w.ct = ct;
    return {
      note: `${fmt(w.plain.length)} of data became ${fmt(ct.length)} (the last 16 bytes are the GCM tag). The random key is ${toHex(w.aesKey).slice(0, 16)}…, kept secret.`,
      viz: {
        kind: 'aes',
        plain: mode === 'text' ? secret : fileName,
        key: toHex(w.aesKey).slice(0, 16),
        cipher: toHex(ct.slice(0, Math.min(10, ct.length - 16))),
        tag: toHex(ct.slice(-16)).slice(0, 16),
      },
    };
  }

  async function lockWithRsa(): Promise<Out> {
    w.wrapped = S.rsaEncrypt(Array.from(w.aesKey!), rsa.N, rsa.e);
    return {
      note: `Bob's public RSA key is N = ${rsa.N}, e = ${rsa.e}. The 32-byte AES key is locked one byte at a time, so it becomes ${w.wrapped.length} numbers. Now only Bob's private key can unlock it.`,
      viz: { kind: 'lock', N: rsa.N, e: rsa.e, pairs: [0, 1, 2, 3].map(i => [w.aesKey![i]!, w.wrapped![i]!] as [number, number]) },
    };
  }

  async function eveRecords1(): Promise<Out> {
    return {
      note: 'Eve copies the encrypted data and the locked key from the network. She cannot read either one yet, so she just keeps them.',
      viz: { kind: 'record', items: ['Encrypted data', 'RSA-locked AES key'] },
    };
  }

  async function shorBreaksRsa(): Promise<Out> {
    await sleep(30); // let the page show "working" first
    const res = S.shor(rsa.N, { shots: 20, maxTries: 12 });
    const f = res.factors;
    if (!f.ok) return { note: "Shor was unlucky this time, so it didn't find the factors. Press the button again.", retry: true };
    w.d = S.rsaPrivateFromFactors(f.p, f.q, rsa.e) as number;
    return {
      note: `Shor found the factors: ${rsa.N} = ${f.p} × ${f.q}. From p and q, Eve works out Bob's private key d = ${w.d}.`,
      viz: { kind: 'factor', N: rsa.N, p: f.p, q: f.q, phi: (f.p - 1) * (f.q - 1), e: rsa.e, d: w.d, qubits: 3 * S.bitLength(rsa.N) },
    };
  }

  async function decryptWithStolenKey(): Promise<Out> {
    const key = Uint8Array.from(S.rsaDecrypt(w.wrapped!, rsa.N, w.d!));
    const out = await aesOpen(key, w.iv!, w.ct!);
    let text: string;
    if (mode === 'text') {
      text = new TextDecoder().decode(out);
    } else {
      url = URL.createObjectURL(new Blob([out as unknown as BlobPart]));
      text = `${fileName} (${fmt(out.length)}), SHA-256 ${equalBytes(out, w.plain!) ? 'matches the original' : 'differs'}: ${await sha(out)}…`;
    }
    return {
      note: 'With d, Eve unlocks the AES key. With the AES key, AES-GCM decrypts the data. RSA is broken.',
      reads: { kind: 'bad', text },
      viz: { kind: 'unlock', N: rsa.N, d: w.d!, pairs: [0, 1, 2, 3].map(i => [w.wrapped![i]!, key[i]!] as [number, number]) },
    };
  }

  // ---- act 2: the fix, with the hybrid ----

  async function encryptHybrid(): Promise<Out> {
    w.hybKeys = await generateReceiverKeys(realSuite);
    const est = await establish(realSuite, w.hybKeys);
    const nonce = randomBytes(NONCE_LEN);
    w.hyb = await sealWithKey(est.key, buildHeader(est.ctM, est.ephPub, nonce), nonce, w.plain!);
    w.ssX = est.ssX; w.pkX = w.hybKeys.pkX; w.realKey = est.key;
    return {
      note: `The same data is encrypted again with AES-256-GCM. This time the key is made from two exchanges mixed together: X25519 and ML-KEM-768. The ML-KEM part adds ${est.ctM.length} bytes to the file.`,
      viz: { kind: 'mix', keyHex: toHex(est.key).slice(0, 16), ctM: est.ctM.length },
    };
  }

  async function eveRecords2(): Promise<Out> {
    return {
      note: 'Eve records this new file too, and waits for her quantum computer, just like before.',
      viz: { kind: 'record', items: ['Encrypted data', `ML-KEM ciphertext (${w.hyb!.length > 0 ? parseFile(w.hyb!).ctM.length : 0} B)`, 'X25519 public key (32 B)'] },
    };
  }

  async function shorFailsOnHybrid(): Promise<Out> {
    await sleep(30);
    return {
      note: "Eve runs Shor again. X25519 is an elliptic-curve scheme, so Shor breaks it and she gets its secret. (Our toy simulator can't break a real curve, so the demo just hands her that secret.) But ML-KEM-768 is built on lattices. There is no loop for Shor to find, so that secret stays hidden.",
      viz: { kind: 'shor2' },
    };
  }

  async function eveTriesAgain(): Promise<Out> {
    // she has the x25519 secret but has to guess the ml-kem one
    const p = parseFile(w.hyb!);
    const guessKey = await deriveFileKey(randomBytes(32), w.ssX!, p.ctM, p.ephPub, w.pkX!);
    try {
      await openWithKey(guessKey, p);
      return { note: 'Eve decrypted the hybrid copy (this should never happen).', reads: { kind: 'bad', text: 'Unexpected.' } };
    } catch {
      return {
        note: 'Her key mixes the X25519 secret with a guessed ML-KEM secret, so it is the wrong key and AES-GCM rejects it. Breaking one half is not enough. (An illustration, not a proof that ML-KEM is unbreakable.)',
        reads: { kind: 'ok', text: 'Nothing. AES-GCM rejected her key, so the data stays scrambled.' },
        viz: { kind: 'wrongkey', real: toHex(w.realKey!).slice(0, 16), guess: toHex(guessKey).slice(0, 16) },
      };
    }
  }

  // ---- the list of steps ----

  interface Step { act: 1 | 2; title: string; text: string; run: () => Promise<Out> }
  const STEPS: Step[] = [
    { act: 1, title: 'Encrypt the data with AES-256-GCM', text: 'A random 256-bit key locks the data. AES-GCM also adds a tag, so any tampering is detected.', run: encryptAes },
    { act: 1, title: 'Lock the AES key with RSA', text: "Alice needs to send that key to Bob safely, so she locks it with Bob's public RSA key.", run: lockWithRsa },
    { act: 1, title: 'Eve records everything', text: 'Eve sits on the network and copies what Alice sends.', run: eveRecords1 },
    { act: 1, title: 'Years later: Eve runs Shor on the RSA key', text: "Eve now has a quantum computer. Shor's algorithm factors N, which gives her Bob's private key.", run: shorBreaksRsa },
    { act: 1, title: 'Eve decrypts the data', text: 'She unlocks the AES key with the stolen private key, then decrypts the data.', run: decryptWithStolenKey },
    { act: 2, title: 'Encrypt the data again with the hybrid', text: 'Same data, same AES-256-GCM, but the key now comes from X25519 and ML-KEM-768 together.', run: encryptHybrid },
    { act: 2, title: 'Eve records it again', text: 'Eve records the new file, exactly like before.', run: eveRecords2 },
    { act: 2, title: 'Years later: Eve runs Shor again', text: 'Same quantum computer, same algorithm. Can it break this one?', run: shorFailsOnHybrid },
    { act: 2, title: 'Eve tries to decrypt', text: 'She has the X25519 secret, but not the ML-KEM one.', run: eveTriesAgain },
  ];

  async function runNext(): Promise<void> {
    if (busy || step >= STEPS.length) return;
    busy = true;
    try {
      const out = await STEPS[step]!.run();
      outs = [...outs.slice(0, step), out];
      if (!out.retry) step += 1;
    } catch (e) {
      outs = [...outs.slice(0, step), { note: String(e) }];
    }
    busy = false;
    await tick();
    document.querySelector('.stepcard.now, .summary')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
</script>

<div class="attack">
  <div class="panel setup">
    <div>
      <label for="mode-text">What does Alice send?</label>
      <div class="seg" style="margin:0">
        <button id="mode-text" class:on={mode === 'text'} onclick={() => setMode('text')}>Text message</button>
        <button class:on={mode === 'file'} onclick={() => setMode('file')}>File</button>
      </div>
    </div>
    <div>
      {#if mode === 'text'}
        <label for="secret">Message</label>
        <input id="secret" type="text" bind:value={secret} maxlength="60" oninput={reset}>
      {:else}
        <label for="f">Choose a file (it stays in your browser)</label>
        <input id="f" type="file" onchange={onFile}>
      {/if}
    </div>
    <div>
      <label for="pq">Bob's toy RSA key</label>
      <select id="pq" bind:value={pq} onchange={reset} disabled={step > 0}>
        {#each PQ as pair, i}<option value={i}>{pair[0]} × {pair[1]} → N = {pair[0] * pair[1]}</option>{/each}
      </select>
    </div>
    <button onclick={reset} disabled={step === 0}>Start over</button>
  </div>

  <div class="flow">
    {#each [1, 2] as act}
      <div class="act">
        <h2>{act === 1 ? 'Act 1: today, protected by RSA' : 'Act 2: the fix, protected by the hybrid (X25519 + ML-KEM)'}</h2>
      </div>
      {#each STEPS as s, i}
        {#if s.act === act}
          <div class="stepcard" class:now={i === step} class:todo={i > step} class:done={i < step}>
            <span class="num">{i < step ? '✓' : i + 1}</span>
            <div class="body">
              <b>{s.title}</b>
              <p>{s.text}</p>

              {#if i <= step && outs[i]}
                {@const o = outs[i]!}
                <div class="out">
                  {#if o.viz}<div><AttackViz viz={o.viz} /></div>{/if}
                  <div>{o.note}</div>
                  {#if o.reads}
                    <div>
                      <span class="lbl">What Eve reads</span>
                      <div class="reads {o.reads.kind}">{o.reads.text}</div>
                      {#if o.reads.kind === 'bad' && url}<p class="caption"><a href={url} download={'recovered-' + fileName}>Download the file Eve recovered</a></p>{/if}
                    </div>
                  {/if}
                </div>
              {/if}

              {#if i === step}
                <button class="primary" onclick={runNext} disabled={busy || !canStart}>
                  {busy ? 'Working…' : i === 0 ? 'Start' : outs[i]?.retry ? 'Try again' : 'Next step'}
                </button>
              {/if}
            </div>
          </div>
        {/if}
      {/each}
    {/each}

    {#if step >= STEPS.length}
      <div class="panel summary">
        <h2>What we learned</h2>
        <div class="results">
          <div class="reads bad"><b>RSA:</b> Shor factored N, so Eve got the private key and read the data.</div>
          <div class="reads ok"><b>Hybrid:</b> Shor broke X25519 but not ML-KEM, so the data stayed scrambled.</div>
        </div>
        <p class="caption">Want to see how Shor finds the factors? <a href="/simulator">Open the simulator →</a> Want to protect a real file? <a href="/encrypt">Encrypt a file →</a></p>
      </div>
    {/if}
  </div>
</div>
