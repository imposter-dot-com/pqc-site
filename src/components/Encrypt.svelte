<script lang="ts">
  import { realSuite, MLKEM_PUBLIC_LEN } from '../lib/suite.ts';
  import { generateReceiverKeys, publicBundle, encryptFile, decryptFile, parseFile } from '../lib/hybrid.ts';
  import type { ReceiverKeys, Parsed } from '../lib/hybrid.ts';
  import { toHex, equalBytes } from '../lib/bytes.ts';

  interface Step { name: string; ms: number; bytes?: number }

  let keys = $state<ReceiverKeys | null>(null);
  let keyMs = $state(0);
  let fileName = $state('');
  let plain: Uint8Array | null = null;
  let blob = $state<Uint8Array | null>(null);
  let steps = $state<Step[]>([]);
  let result = $state<{ ok: boolean; text: string } | null>(null);
  let error = $state('');
  let url = $state('');
  let busy = $state(false);

  const parsed = $derived<Parsed | null>(blob ? parseFile(blob) : null);
  const fmt = (n: number): string => n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(2)} MB`;
  const sha = async (b: Uint8Array): Promise<string> => toHex(new Uint8Array(await crypto.subtle.digest('SHA-256', b as unknown as BufferSource)));

  async function genKeys(): Promise<void> {
    error = ''; busy = true;
    try {
      const t = performance.now();
      keys = await generateReceiverKeys(realSuite);
      keyMs = performance.now() - t; blob = null; result = null; steps = [];
    } catch (e) { error = String(e); }
    busy = false;
  }
  async function onFile(ev: Event): Promise<void> {
    const f = (ev.target as HTMLInputElement).files?.[0];
    if (!f) return;
    fileName = f.name; plain = new Uint8Array(await f.arrayBuffer()); blob = null; result = null; steps = [];
  }
  async function doEncrypt(): Promise<void> {
    error = ''; result = null;
    if (!keys || !plain) { error = 'Generate the receiver keys and choose a file first.'; return; }
    busy = true; steps = [];
    try {
      blob = await encryptFile(realSuite, keys, plain, (name, ms, bytes) => { steps = [...steps, { name, ms, bytes }]; });
      if (url) URL.revokeObjectURL(url);
      url = URL.createObjectURL(new Blob([blob as unknown as BlobPart], { type: 'application/octet-stream' }));
    } catch (e) { error = String(e); }
    busy = false;
  }
  async function doDecrypt(tamper: boolean): Promise<void> {
    error = ''; result = null;
    if (!keys || !blob || !plain) { error = 'Encrypt a file first.'; return; }
    busy = true;
    const copy = blob.slice();
    if (tamper && parsed) copy[parsed.offsets.body + 10 % Math.max(1, parsed.body.length)] ^= 1;   // flip one bit of the encrypted data to show that tampering gets caught
    try {
      const out = await decryptFile(realSuite, keys, copy);
      const same = equalBytes(out, plain);
      result = { ok: same, text: same ? `Decrypted. SHA-256 of the result equals the original (${(await sha(out)).slice(0, 16)}...).` : 'Decrypted but the content differs from the original.' };
    } catch {
      result = { ok: false, text: 'REJECTED: the AES-GCM authentication tag does not match. The file was changed or the keys are wrong.' };
    }
    busy = false;
  }
  const maxBar = 1216;
</script>

<div class="two">
  <div class="stack">
    <div class="panel flowy">
      <h2>Bob creates his keys</h2>
      <p class="caption">Bob (the receiver) makes an X25519 and an ML-KEM-768 key pair and shares the public halves. They don't encrypt the file directly. They let the sender agree on a fresh AES key in the next step, and Bob's private halves open the file at the end. The keys stay in this page's memory.</p>
      <button onclick={genKeys} disabled={busy}>Create Bob's keys</button>
      {#if keys}
        <div class="kv">
          <div><b>Public key bundle</b><span>{publicBundle(keys).length} B</span></div>
          <div><b>ML-KEM-768 public</b><span>{keys.pkM.length} B</span></div>
          <div><b>X25519 public</b><span>{keys.pkX.length} B</span></div>
          <div><b>Key generation</b><span>{keyMs.toFixed(1)} ms</span></div>
        </div>
        <div class="sub">Public key bundle (first 48 bytes)</div>
        <div class="hex mono">{toHex(publicBundle(keys).slice(0, 48))}...</div>
        {#if keys.pkM.length !== MLKEM_PUBLIC_LEN}<div class="result bad">Unexpected ML-KEM public key size.</div>{/if}
      {/if}
    </div>

    <div class="panel flowy">
      <h2>Alice encrypts a file</h2>
      <p class="caption">Her browser makes a fresh AES-256 key from Bob's public keys, then encrypts the file with it.</p>
      <input type="file" onchange={onFile}>
      <button class="primary" onclick={doEncrypt} disabled={busy || !keys || !fileName}>Encrypt {fileName || 'file'}</button>
      {#if steps.length}
        <div class="sub">What happened, step by step</div>
        <div class="steps">
          {#each steps as s}
            <div class="step done"><b>{s.name}</b><span>{s.ms.toFixed(2)} ms{s.bytes !== undefined ? ' · ' + fmt(s.bytes) : ''}</span></div>
          {/each}
        </div>
      {/if}
      {#if blob && parsed}
        <div class="kv">
          <div><b>Original</b><span>{fmt(plain?.length ?? 0)}</span></div>
          <div><b>Encrypted file</b><span>{fmt(blob.length)}</span></div>
        </div>
        <div class="sub">File header (this travels with the file)</div>
        <div class="hdr">
          <div class="hrow"><span class="hl">File type and version</span><span class="hv m mono">PQE1, version {blob[4]}</span></div>
          <div class="hrow"><span class="hl">ML-KEM ciphertext ({parsed.ctM.length} bytes, first 24 shown)</span><span class="hv c mono">{toHex(parsed.ctM.slice(0, 24))}…</span></div>
          <div class="hrow"><span class="hl">Ephemeral X25519 key (32 bytes)</span><span class="hv e mono">{toHex(parsed.ephPub)}</span></div>
          <div class="hrow"><span class="hl">AES-GCM nonce (12 bytes)</span><span class="hv n mono">{toHex(parsed.nonce)}</span></div>
        </div>
        <p class="dl"><a href={url} download={fileName + '.pqenc'}>Download {fileName}.pqenc</a></p>
      {/if}
      {#if error}<div class="result bad">{error}</div>{/if}
    </div>

    <div class="panel flowy">
      <h2>Bob decrypts</h2>
      <div class="row">
        <button onclick={() => doDecrypt(false)} disabled={busy || !blob}>Decrypt</button>
        <button onclick={() => doDecrypt(true)} disabled={busy || !blob}>Change one bit, then decrypt</button>
      </div>
      {#if result}<div class="result {result.ok ? 'ok' : 'bad'}">{result.text}</div>{/if}
    </div>
  </div>

  <div class="stack">
    <div class="panel">
      <h2>Key material sizes (bytes)</h2>
      <div class="bars">
        <div class="bar"><em>X25519</em><div class="track"><i style="width:{32 / maxBar * 100}%;background:var(--cyan)"></i></div><span class="num2">32</span></div>
        <div class="bar"><em>ML-KEM-768</em><div class="track"><i style="width:{1184 / maxBar * 100}%;background:var(--violet)"></i></div><span class="num2">1,184</span></div>
        <div class="bar"><em>Hybrid (both)</em><div class="track"><i style="width:100%;background:var(--amber)"></i></div><span class="num2">1,216</span></div>
      </div>
      <p class="caption">The main cost of the hybrid is size, not time.</p>
    </div>
    <div class="panel">
      <h2>How the file key is made</h2>
      <p class="caption">K = HKDF-SHA256( ss<sub>ML-KEM</sub> || ss<sub>X25519</sub> || ct<sub>ML-KEM</sub> || eph<sub>X25519</sub> || pk<sub>X25519</sub> )</p>
      <p class="caption">The file is encrypted with AES-256-GCM using K and a random 12-byte nonce, and the header is authenticated too. A new K is made for every file. If either shared secret is wrong, K is different and decryption is rejected.</p>
    </div>
  </div>
</div>
