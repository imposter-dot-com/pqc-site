<script lang="ts">
  import type { Viz } from '../lib/attack-viz.ts';
  let { viz }: { viz: Viz } = $props();

  // two little bar pictures for the shor step: a repeating pattern, and noise
  const LOOP = [14, 34, 22, 8, 14, 34, 22, 8, 14, 34, 22, 8];
  const NOISE = [22, 8, 36, 14, 28, 10, 34, 20, 12, 30, 16, 26];
</script>

{#if viz.kind === 'aes'}
  <div class="viz">
    <div class="vb data"><small>Your data</small>{viz.plain}</div>
    <span class="va">+</span>
    <div class="vb key"><small>Random key (256-bit)</small><span class="mono">{viz.key}…</span></div>
    <span class="va"><i>→</i><small>AES-256-GCM</small></span>
    <div class="vb data"><small>Scrambled data</small><span class="mono">{viz.cipher}…</span></div>
    <span class="va">+</span>
    <div class="vb tag"><small>Tag (16 bytes)</small><span class="mono">{viz.tag}…</span></div>
  </div>
  <p class="vnote">The tag is a checksum made with the key. Change one bit of the data and the tag no longer matches.</p>

{:else if viz.kind === 'lock'}
  <div class="viz col">
    {#each viz.pairs as [b, c], i}
      <div class="lockrow">
        <div class="vb key"><small>Key byte {i + 1}</small>{b}</div>
        <span class="va"><i>→</i><small>{b}<sup>{viz.e}</sup> mod {viz.N}</small></span>
        <div class="vb lock"><small>Locked</small>{c}</div>
      </div>
    {/each}
    <div class="lockrow more">… and the same for the other 28 bytes</div>
  </div>
  <p class="vnote">Locking is easy for anyone who knows the public key (N and e). Unlocking needs the private key d.</p>

{:else if viz.kind === 'record'}
  <div class="viz col">
    <div class="rowflex">
      <div class="vb">Alice</div>
      <span class="va"><i>→</i></span>
      <div class="wire">{#each viz.items as item}<span class="pkt">{item}</span>{/each}</div>
      <span class="va"><i>→</i></span>
      <div class="vb">Bob</div>
    </div>
    <div class="rowflex eve">
      <span class="va"><i>↓</i><small>copies everything</small></span>
      <div class="vb bad">Eve</div>
    </div>
  </div>

{:else if viz.kind === 'factor'}
  <div class="viz">
    <div class="vb lock"><small>Public key</small>N = {viz.N}</div>
    <span class="va"><i>→</i><small>Shor ({viz.qubits} qubits)</small></span>
    <div class="vb bad"><small>p</small>{viz.p}</div>
    <span class="va">×</span>
    <div class="vb bad"><small>q</small>{viz.q}</div>
    <span class="va"><i>→</i><small>φ = (p−1)(q−1)</small></span>
    <div class="vb"><small>φ</small>{viz.phi}</div>
    <span class="va"><i>→</i><small>d = e⁻¹ mod φ</small></span>
    <div class="vb bad"><small>Private key d</small>{viz.d}</div>
  </div>
  <p class="vnote">Check: e × d = {viz.e} × {viz.d} = {viz.e * viz.d} = {Math.floor((viz.e * viz.d) / viz.phi)} × {viz.phi} + 1. It leaves remainder 1, so d undoes e.</p>

{:else if viz.kind === 'unlock'}
  <div class="viz col">
    {#each viz.pairs as [c, b], i}
      <div class="lockrow">
        <div class="vb lock"><small>Locked byte {i + 1}</small>{c}</div>
        <span class="va"><i>→</i><small>{c}<sup>{viz.d}</sup> mod {viz.N}</small></span>
        <div class="vb key"><small>Key byte</small>{b}</div>
      </div>
    {/each}
    <div class="lockrow more">… all 32 bytes, so Eve has the AES key, and AES-GCM opens the data</div>
  </div>

{:else if viz.kind === 'mix'}
  <div class="viz">
    <div class="stack">
      <div class="vb key"><small>X25519 secret</small>32 bytes</div>
      <div class="vb key"><small>ML-KEM secret</small>32 bytes</div>
    </div>
    <span class="va"><i>→</i><small>mixed (HKDF-SHA256)</small></span>
    <div class="vb key"><small>AES-256 key</small><span class="mono">{viz.keyHex}…</span></div>
    <span class="va"><i>→</i><small>AES-256-GCM</small></span>
    <div class="vb data"><small>Encrypted file</small>+ ML-KEM part ({viz.ctM} B)</div>
  </div>
  <p class="vnote">The key depends on both secrets. If either one is wrong, the key comes out completely different.</p>

{:else if viz.kind === 'shor2'}
  <div class="viz col">
    <div class="lane">
      <div class="vb"><small>Elliptic curve</small>X25519</div>
      <span class="va"><i>→</i></span>
      <svg class="loopbars" viewBox="0 0 120 44" aria-label="a repeating pattern">
        {#each LOOP as h, i}<rect x={i * 10 + 1} y={44 - h} width="7" height={h} rx="1.5" fill="#d92d4b" />{/each}
      </svg>
      <span class="va"><i>→</i></span>
      <div class="vb bad"><small>Shor finds the loop</small>secret recovered</div>
    </div>
    <div class="lane">
      <div class="vb"><small>Lattice</small>ML-KEM-768</div>
      <span class="va"><i>→</i></span>
      <svg class="loopbars" viewBox="0 0 120 44" aria-label="noise with no pattern">
        {#each NOISE as h, i}<rect x={i * 10 + 1} y={44 - h} width="7" height={h} rx="1.5" fill="#98a1b3" />{/each}
      </svg>
      <span class="va"><i>→</i></span>
      <div class="vb ok"><small>No loop to find</small>secret stays hidden</div>
    </div>
  </div>
  <p class="vnote">Shor's algorithm finds repeating patterns. X25519 hides one, so it breaks. ML-KEM hides no pattern, so Shor has nothing to find.</p>

{:else if viz.kind === 'wrongkey'}
  <div class="viz">
    <div class="stack">
      <div class="vb bad"><small>X25519 secret</small>Eve has it</div>
      <div class="vb"><small>ML-KEM secret</small>Eve can only guess</div>
    </div>
    <span class="va"><i>→</i><small>mixed</small></span>
    <div class="vb key"><small>Eve's key</small><span class="mono">{viz.guess}…</span></div>
    <span class="va">≠</span>
    <div class="vb ok"><small>Real key</small><span class="mono">{viz.real}…</span></div>
    <span class="va"><i>→</i><small>AES-256-GCM</small></span>
    <div class="vb ok"><small>Tag check</small>fails ✕</div>
  </div>
{/if}
