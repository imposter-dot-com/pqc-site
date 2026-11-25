<script lang="ts">
  import { realSuite, MLKEM_PUBLIC_LEN } from '../lib/crypto/suite.ts';
  import { generateReceiverKeys, publicBundle, encryptFile, decryptFile, parseFile } from '../lib/crypto/hybrid.ts';
  import type { ReceiverKeys, Parsed } from '../lib/crypto/hybrid.ts';
  import { toHex, equalBytes } from '../lib/crypto/bytes.ts';
  import { shared } from '../styles/shared.ts';
  import { encryptStyles as css } from '../styles/encrypt.ts';

  interface Step { name: string; ms: number; bytes?: number }

  // why Eve cannot just guess: the file key is 256 bits, so there are 2^256 keys to try.
  // (an illustration: it assumes a machine that tries a billion billion keys every second, which does not exist)
  const KEY_BITS = 256;
  const GUESSES_PER_SECOND = 1e18;
  const SECONDS_PER_YEAR = 365.25 * 24 * 3600;
  const AGE_OF_UNIVERSE_YEARS = 1.38e10;
  const exp = (x: number): string => { const [mantissa, power] = x.toExponential(2).split('e+'); return `${mantissa} × 10<sup>${power}</sup>`; };
  const allKeys = 2 ** KEY_BITS;
  const yearsClassical = allKeys / GUESSES_PER_SECOND / SECONDS_PER_YEAR;
  // grover's algorithm gives a quantum computer only a square-root speed-up on a search like this: 2^256 becomes 2^128 steps
  const yearsGrover = 2 ** (KEY_BITS / 2) / GUESSES_PER_SECOND / SECONDS_PER_YEAR;

  let keys = $state<ReceiverKeys | null>(null);
  let keyMs = $state(0);
  let fileName = $state('');
  let plain: Uint8Array | null = null;
  let blob = $state<Uint8Array | null>(null);
  let steps = $state<Step[]>([]);
  let result = $state<{ ok: boolean; text: string } | null>(null);
  let error = $state('');
  let url = $state('');
  let fileType = '';
  // the file Bob got back after decrypting: a link to download it, and what to show of its content
  let recovered = $state<{ url: string; size: number; kind: 'image' | 'text' | 'binary'; text: string } | null>(null);
  // which button is working right now (all buttons wait while one works), and what the last click did
  let working = $state<'' | 'keys' | 'encrypt' | 'decrypt'>('');
  const busy = $derived(working !== '');
  let keyNote = $state('');
  let encryptNote = $state('');

  const parsed = $derived<Parsed | null>(blob ? parseFile(blob) : null);
  const fmt = (n: number): string => n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(2)} MB`;
  const sha = async (b: Uint8Array): Promise<string> => toHex(new Uint8Array(await crypto.subtle.digest('SHA-256', b as unknown as BufferSource)));

  function forgetRecovered(): void {
    if (recovered) URL.revokeObjectURL(recovered.url);
    recovered = null;
  }
  // what to show of a decrypted file: the picture itself, the first lines of a text file, or the first bytes of anything else
  function describe(bytes: Uint8Array, type: string): { kind: 'image' | 'text' | 'binary'; text: string } {
    if (type.startsWith('image/')) return { kind: 'image', text: '' };
    const head = bytes.slice(0, 600);
    if (!head.includes(0)) {
      try {
        const text = new TextDecoder('utf-8', { fatal: true }).decode(head);
        return { kind: 'text', text: text + (bytes.length > head.length ? '\n...' : '') };
      } catch { /* not text, so show the bytes */ }
    }
    return { kind: 'binary', text: toHex(bytes.slice(0, 48)) + (bytes.length > 48 ? '...' : '') };
  }

  async function genKeys(): Promise<void> {
    error = ''; working = 'keys'; forgetRecovered();
    const hadFile = !!blob;
    try {
      const t = performance.now();
      keys = await generateReceiverKeys(realSuite);
      keyMs = performance.now() - t; blob = null; result = null; steps = []; encryptNote = '';
      keyNote = `Created Bob's keys: an X25519 pair and an ML-KEM-768 pair, in ${keyMs.toFixed(1)} ms. The ${fmt(publicBundle(keys).length)} of public keys can be shared. The private halves stay in this page's memory.` +
        (hadFile ? ' The earlier encrypted file was cleared, because it belonged to the old keys.' : '');
    } catch (e) { error = String(e); }
    working = '';
  }
  async function onFile(ev: Event): Promise<void> {
    const f = (ev.target as HTMLInputElement).files?.[0];
    if (!f) return;
    fileName = f.name; fileType = f.type; plain = new Uint8Array(await f.arrayBuffer()); blob = null; result = null; steps = []; encryptNote = ''; forgetRecovered();
  }
  async function doEncrypt(): Promise<void> {
    error = ''; result = null; forgetRecovered();
    if (!keys || !plain) { error = 'Generate the receiver keys and choose a file first.'; return; }
    working = 'encrypt'; steps = [];
    try {
      blob = await encryptFile(realSuite, keys, plain, (name, ms, bytes) => { steps = [...steps, { name, ms, bytes }]; });
      if (url) URL.revokeObjectURL(url);
      url = URL.createObjectURL(new Blob([blob as unknown as BlobPart], { type: 'application/octet-stream' }));
      encryptNote = `Encrypted ${fileName} (${fmt(plain.length)}) into ${fileName}.pqenc (${fmt(blob.length)}) with AES-256-GCM. The key was made from both of Bob's key exchanges, so opening the file takes both of his private keys.`;
    } catch (e) { error = String(e); }
    working = '';
  }
  async function doDecrypt(tamper: boolean): Promise<void> {
    error = ''; result = null; forgetRecovered();
    if (!keys || !blob || !plain) { error = 'Encrypt a file first.'; return; }
    working = 'decrypt';
    const copy = blob.slice();
    if (tamper && parsed) copy[parsed.offsets.body + 10 % Math.max(1, parsed.body.length)] ^= 1;   // flip one bit of the encrypted data to show that tampering gets caught
    const did = tamper ? 'We flipped one bit of the encrypted data, then tried to decrypt it. ' : 'Bob rebuilt the key from his private keys and decrypted the file. ';
    try {
      const out = await decryptFile(realSuite, keys, copy);
      const same = equalBytes(out, plain);
      if (same) recovered = { url: URL.createObjectURL(new Blob([out as unknown as BlobPart], { type: fileType || 'application/octet-stream' })), size: out.length, ...describe(out, fileType) };
      result = { ok: same, text: same ? `${did}The tag matched, and the SHA-256 of the result equals the original (${(await sha(out)).slice(0, 16)}...), so nothing changed.` : `${did}It decrypted, but the content differs from the original.` };
    } catch {
      result = { ok: false, text: `${did}REJECTED: the AES-GCM tag does not match, so the ${tamper ? 'change was caught' : 'file was changed or the keys are wrong'}.` };
    }
    working = '';
  }
</script>

<div class={css.page}>
  <div class={css.column}>
    <div class={shared.flowPanel}>
      <h2 class={shared.panelTitle}>Bob creates his keys</h2>
      <p class={shared.caption}>Bob (the receiver) makes an X25519 and an ML-KEM-768 key pair and shares the public halves. They don't encrypt the file directly. They let the sender agree on a fresh AES key in the next step, and Bob's private halves open the file at the end. The keys stay in this page's memory.</p>
      <button onclick={genKeys} disabled={busy}>{working === 'keys' ? 'Creating keys…' : "Create Bob's keys"}</button>
      {#if keyNote}<div class={shared.resultGood}>{keyNote}</div>{/if}
      {#if keys}
        <div class={css.tiles}>
          <div class={shared.kvCell}><b class={shared.kvLabel}>Public key bundle</b><span class={shared.kvValue}>{publicBundle(keys).length} B</span></div>
          <div class={shared.kvCell}><b class={shared.kvLabel}>ML-KEM-768 public</b><span class={shared.kvValue}>{keys.pkM.length} B</span></div>
          <div class={shared.kvCell}><b class={shared.kvLabel}>X25519 public</b><span class={shared.kvValue}>{keys.pkX.length} B</span></div>
          <div class={shared.kvCell}><b class={shared.kvLabel}>Key generation</b><span class={shared.kvValue}>{keyMs.toFixed(1)} ms</span></div>
        </div>
        <p class={shared.caption}>The main cost of the hybrid is size, not time.</p>
        <div class={css.subheading}>Public key bundle (first 48 bytes)</div>
        <div class={css.hexBox}>{toHex(publicBundle(keys).slice(0, 48))}...</div>
        {#if keys.pkM.length !== MLKEM_PUBLIC_LEN}<div class={shared.resultFail}>Unexpected ML-KEM public key size.</div>{/if}
      {/if}
    </div>

    <div class={shared.flowPanel}>
      <h2 class={shared.panelTitle}>Alice encrypts a file</h2>
      <p class={shared.caption}>Her browser makes a fresh AES-256 key from Bob's public keys, then encrypts the file with it.</p>
      <input type="file" onchange={onFile}>
      <button class={shared.primary} onclick={doEncrypt} disabled={busy || !keys || !fileName}>{working === 'encrypt' ? 'Encrypting…' : 'Encrypt ' + (fileName || 'file')}</button>
      {#if !keys}<p class={shared.caption}>Create Bob's keys first, then choose a file.</p>{:else if !fileName}<p class={shared.caption}>Choose a file to encrypt.</p>{/if}
      {#if encryptNote}<div class={shared.resultGood}>{encryptNote}</div>{/if}
      {#if steps.length}
        <div class={css.subheading}>What happened, step by step</div>
        <div class={css.stepGrid}>
          {#each steps as s}
            <div class={css.stepCard}><b class={css.stepName}>{s.name}</b><span class={css.stepDetail}>{s.ms.toFixed(2)} ms{s.bytes !== undefined ? ' · ' + fmt(s.bytes) : ''}</span></div>
          {/each}
        </div>
      {/if}
      {#if blob && parsed}
        <div class={css.tiles}>
          <div class={shared.kvCell}><b class={shared.kvLabel}>Original</b><span class={shared.kvValue}>{fmt(plain?.length ?? 0)}</span></div>
          <div class={shared.kvCell}><b class={shared.kvLabel}>Encrypted file</b><span class={shared.kvValue}>{fmt(blob.length)}</span></div>
        </div>
        <div class={css.subheading}>File header (this travels with the file)</div>
        <div class={css.headerBox}>
          {#each [
            ['File type and version', 'PQE1, version ' + blob[4], 'text-warn-ink'],
            [`ML-KEM ciphertext (${parsed.ctM.length} bytes, first 24 shown)`, toHex(parsed.ctM.slice(0, 24)) + '…', 'text-violet'],
            ['Ephemeral X25519 key (32 bytes)', toHex(parsed.ephPub), 'text-teal-ink'],
            ['AES-GCM nonce (12 bytes)', toHex(parsed.nonce), 'text-green'],
          ] as [label, value, color]}
            <div><span class={css.headerLabel}>{label}</span><span class="{css.headerValue} {color}">{value}</span></div>
          {/each}
        </div>
        <p><a class="font-semibold" href={url} download={fileName + '.pqenc'}>Download {fileName}.pqenc</a></p>
      {/if}
      {#if error}<div class={shared.resultFail}>{error}</div>{/if}
    </div>

    <div class={shared.flowPanel}>
      <h2 class={shared.panelTitle}>Bob decrypts</h2>
      <div class={shared.row}>
        <button onclick={() => doDecrypt(false)} disabled={busy || !blob}>{working === 'decrypt' ? 'Working…' : 'Decrypt'}</button>
        <button onclick={() => doDecrypt(true)} disabled={busy || !blob}>Change one bit, then decrypt</button>
      </div>
      {#if !blob}<p class={shared.caption}>Encrypt a file first.</p>{/if}
      {#if result}<div class={result.ok ? shared.resultGood : shared.resultFail}>{result.text}</div>{/if}
      {#if recovered}
        <div class={css.subheading}>The decrypted file: {fileName} ({fmt(recovered.size)}), the same as the original</div>
        {#if recovered.kind === 'image'}
          <img src={recovered.url} alt={'The decrypted ' + fileName} class={css.previewImage}>
        {:else}
          <div class={css.previewText}>{recovered.text}</div>
          {#if recovered.kind === 'binary'}<p class={shared.caption}>This is not a text file, so these are its first bytes.</p>{/if}
        {/if}
        <p><a class="font-semibold" href={recovered.url} download={fileName}>Download the decrypted {fileName}</a></p>
      {/if}
    </div>
  </div>

  <div class={css.column}>
    <div class={shared.panel}>
      <h2 class={shared.panelTitle}>How the file key is made</h2>
      <p class={shared.caption}>K = HKDF-SHA256( ss<sub>ML-KEM</sub> || ss<sub>X25519</sub> || ct<sub>ML-KEM</sub> || eph<sub>X25519</sub> || pk<sub>X25519</sub> )</p>
      <p class={shared.caption}>The file is encrypted with AES-256-GCM using K and a random 12-byte nonce, and the header is authenticated too. A new K is made for every file. If either shared secret is wrong, K is different and decryption is rejected.</p>
    </div>
    <div class={shared.panel}>
      <h2 class={shared.panelTitle}>Why can't Eve just guess the key?</h2>
      <p class={shared.caption}>Shor's algorithm breaks RSA and X25519 because each hides a repeating pattern that it can find. ML-KEM has no such pattern for it to find, so the only option left is to try keys one by one. The file key is {KEY_BITS} bits, so there are 2<sup>{KEY_BITS}</sup> of them.</p>
      <div class={css.facts}>
        <div class={shared.kvCell}><b class={shared.kvLabel}>Possible keys</b><span class={shared.kvValue}>{@html exp(allKeys)}</span></div>
        <div class={shared.kvCell}><b class={shared.kvLabel}>Trying them all, normal computer</b><span class={shared.kvValue}>{@html exp(yearsClassical)} years</span></div>
        <div class={shared.kvCell}><b class={shared.kvLabel}>Quantum computer (Grover: 2<sup>{KEY_BITS / 2}</sup> steps)</b><span class={shared.kvValue}>{@html exp(yearsGrover)} years</span></div>
        <div class={shared.kvCell}><b class={shared.kvLabel}>Compared with the age of the universe</b><span class={shared.kvValue}>about {Math.round(yearsGrover / AGE_OF_UNIVERSE_YEARS)} times as long</span></div>
      </div>
      <p class={shared.caption}>This is an illustration. It assumes a machine that tries a billion billion keys every second, which does not exist. A quantum computer only gets a square-root speed-up from Grover's algorithm, so 2<sup>{KEY_BITS}</sup> becomes 2<sup>{KEY_BITS / 2}</sup> steps, which is still far too many. The break on RSA and X25519 is different: Shor's algorithm does not guess, it finds the answer directly.</p>
    </div>
  </div>
</div>
