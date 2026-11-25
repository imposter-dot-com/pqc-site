<script lang="ts">
  import { realSuite, MLKEM_PUBLIC_LEN } from '../lib/crypto/suite.ts';
  import { generateReceiverKeys, publicBundle, encryptFile, decryptFile, parseFile } from '../lib/crypto/hybrid.ts';
  import type { ReceiverKeys, Parsed } from '../lib/crypto/hybrid.ts';
  import { toHex, equalBytes } from '../lib/crypto/bytes.ts';
  import { ui } from '../lib/ui/ui.ts';

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
</script>

<div class="grid grid-cols-2 gap-6 items-start max-[900px]:grid-cols-1">
  <div class="flex flex-col gap-2 min-w-0">
    <div class="{ui.panel} {ui.flowy}">
      <h2 class={ui.panelTitle}>Bob creates his keys</h2>
      <p class={ui.caption}>Bob (the receiver) makes an X25519 and an ML-KEM-768 key pair and shares the public halves. They don't encrypt the file directly. They let the sender agree on a fresh AES key in the next step, and Bob's private halves open the file at the end. The keys stay in this page's memory.</p>
      <button onclick={genKeys} disabled={busy}>Create Bob's keys</button>
      {#if keys}
        <div class="grid grid-cols-2 gap-3.5">
          <div class={ui.kvCell}><b class={ui.kvLabel}>Public key bundle</b><span class={ui.kvValue}>{publicBundle(keys).length} B</span></div>
          <div class={ui.kvCell}><b class={ui.kvLabel}>ML-KEM-768 public</b><span class={ui.kvValue}>{keys.pkM.length} B</span></div>
          <div class={ui.kvCell}><b class={ui.kvLabel}>X25519 public</b><span class={ui.kvValue}>{keys.pkX.length} B</span></div>
          <div class={ui.kvCell}><b class={ui.kvLabel}>Key generation</b><span class={ui.kvValue}>{keyMs.toFixed(1)} ms</span></div>
        </div>
        <p class={ui.caption}>The main cost of the hybrid is size, not time.</p>
        <div class="text-[15px] font-semibold text-ink">Public key bundle (first 48 bytes)</div>
        <div class="font-mono text-[14px] break-all bg-panel2 rounded-lg p-2.5">{toHex(publicBundle(keys).slice(0, 48))}...</div>
        {#if keys.pkM.length !== MLKEM_PUBLIC_LEN}<div class="{ui.resultBox} {ui.resultBad}">Unexpected ML-KEM public key size.</div>{/if}
      {/if}
    </div>

    <div class="{ui.panel} {ui.flowy}">
      <h2 class={ui.panelTitle}>Alice encrypts a file</h2>
      <p class={ui.caption}>Her browser makes a fresh AES-256 key from Bob's public keys, then encrypts the file with it.</p>
      <input type="file" onchange={onFile}>
      <button class={ui.primary} onclick={doEncrypt} disabled={busy || !keys || !fileName}>Encrypt {fileName || 'file'}</button>
      {#if steps.length}
        <div class="text-[15px] font-semibold text-ink">What happened, step by step</div>
        <div class="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3.5">
          {#each steps as s}
            <div class="bg-panel2 rounded-lg px-4 py-3.5"><b class="block text-[15px] leading-[1.35]">{s.name}</b><span class="block mt-1 text-[14px] text-muted">{s.ms.toFixed(2)} ms{s.bytes !== undefined ? ' · ' + fmt(s.bytes) : ''}</span></div>
          {/each}
        </div>
      {/if}
      {#if blob && parsed}
        <div class="grid grid-cols-2 gap-3.5">
          <div class={ui.kvCell}><b class={ui.kvLabel}>Original</b><span class={ui.kvValue}>{fmt(plain?.length ?? 0)}</span></div>
          <div class={ui.kvCell}><b class={ui.kvLabel}>Encrypted file</b><span class={ui.kvValue}>{fmt(blob.length)}</span></div>
        </div>
        <div class="text-[15px] font-semibold text-ink">File header (this travels with the file)</div>
        <div class="flex flex-col gap-3.5 bg-panel2 rounded-[10px] px-[18px] py-4">
          {#each [
            ['File type and version', 'PQE1, version ' + blob[4], 'text-warn-ink'],
            [`ML-KEM ciphertext (${parsed.ctM.length} bytes, first 24 shown)`, toHex(parsed.ctM.slice(0, 24)) + '…', 'text-violet'],
            ['Ephemeral X25519 key (32 bytes)', toHex(parsed.ephPub), 'text-teal-ink'],
            ['AES-GCM nonce (12 bytes)', toHex(parsed.nonce), 'text-green'],
          ] as [label, value, color]}
            <div><span class="block text-[14px] text-muted mb-[3px]">{label}</span><span class="block text-[14px] leading-[1.5] break-all font-mono {color}">{value}</span></div>
          {/each}
        </div>
        <p><a class="font-semibold" href={url} download={fileName + '.pqenc'}>Download {fileName}.pqenc</a></p>
      {/if}
      {#if error}<div class="{ui.resultBox} {ui.resultBad}">{error}</div>{/if}
    </div>

    <div class="{ui.panel} {ui.flowy}">
      <h2 class={ui.panelTitle}>Bob decrypts</h2>
      <div class={ui.row}>
        <button onclick={() => doDecrypt(false)} disabled={busy || !blob}>Decrypt</button>
        <button onclick={() => doDecrypt(true)} disabled={busy || !blob}>Change one bit, then decrypt</button>
      </div>
      {#if result}<div class="{ui.resultBox} {result.ok ? ui.resultOk : ui.resultBad}">{result.text}</div>{/if}
    </div>
  </div>

  <div class="flex flex-col gap-2 min-w-0">
    <div class={ui.panel}>
      <h2 class={ui.panelTitle}>How the file key is made</h2>
      <p class={ui.caption}>K = HKDF-SHA256( ss<sub>ML-KEM</sub> || ss<sub>X25519</sub> || ct<sub>ML-KEM</sub> || eph<sub>X25519</sub> || pk<sub>X25519</sub> )</p>
      <p class={ui.caption}>The file is encrypted with AES-256-GCM using K and a random 12-byte nonce, and the header is authenticated too. A new K is made for every file. If either shared secret is wrong, K is different and decryption is rejected.</p>
    </div>
  </div>
</div>
