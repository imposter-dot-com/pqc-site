<script lang="ts">
  import type { Viz } from '../lib/attack-viz.ts';
  let { viz }: { viz: Viz } = $props();
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
      <div class="vb key"><small>Elliptic-curve secret (toy X25519)</small>32 bytes</div>
      <div class="vb key"><small>ML-KEM-768 secret (real)</small>32 bytes</div>
    </div>
    <span class="va"><i>→</i><small>mixed (HKDF-SHA256)</small></span>
    <div class="vb key"><small>AES-256 key</small><span class="mono">{viz.keyHex}…</span></div>
    <span class="va"><i>→</i><small>AES-256-GCM</small></span>
    <div class="vb data"><small>Encrypted file</small>+ ML-KEM part ({viz.ctM} B)</div>
  </div>
  <p class="vnote">The key depends on both secrets. If either one is wrong, the key comes out completely different.</p>

{:else if viz.kind === 'ecdlp'}
  <div class="viz">
    <div class="vb lock"><small>Bob's public point B</small>({viz.B.x}, {viz.B.y})</div>
    <span class="va"><i>→</i><small>Shor ({viz.registerQubits} + {viz.registerQubits} + {viz.pointQubits} qubits)</small></span>
    <div class="vb"><small>Measured (u, v)</small>({viz.shot.u}, {viz.shot.v})</div>
    <span class="va"><i>→</i><small>k = v ÷ u (mod {viz.curve.n})</small></span>
    <div class="vb bad"><small>Bob's secret k</small>{viz.k}</div>
    <span class="va"><i>→</i><small>k × Alice's point</small></span>
    <div class="vb bad"><small>Shared secret</small>{viz.matches ? 'recovered ✓' : 'wrong ✕'}</div>
  </div>
  <p class="vnote">The toy curve is y² = x³ + {viz.curve.a}x + {viz.curve.b} over the numbers mod {viz.curve.p}, with {viz.curve.n} points. Shor used only the public points. It needed {viz.shotsUsed} measurement{viz.shotsUsed === 1 ? '' : 's'}. The secret k is used only at the end, to check the answer.</p>

{:else if viz.kind === 'spectrum'}
  <div class="viz col">
    {#each [viz.loop, viz.noLoop] as s}
      <div class="spec">
        <div class="spec-head">
          <b>{s.title}</b>
          <span class="spec-score" class:bad={s.valid > 0} class:ok={s.valid === 0}>{s.valid} of {s.shots} shots found a loop</span>
        </div>
        <svg class="spectrum" viewBox="0 0 256 64" preserveAspectRatio="none" role="img" aria-label="chance of each measured value">
          <line x1="0" y1="63.5" x2="256" y2="63.5" stroke="#98a1b3" stroke-width="1" vector-effect="non-scaling-stroke" />
          {#each s.blocks as v, i}
            <rect x={i} y={63 - (v / viz.max) * 58} width="0.85" height={Math.max(0.5, (v / viz.max) * 58)} fill={s.color} />
          {/each}
        </svg>
        <div class="spec-axis"><span>{s.caption}</span><span>measured value k →</span></div>
      </div>
    {/each}
  </div>
  <p class="vnote">What this shows: Shor's method only works when a function has a hidden loop. aˣ mod N has one, so the measurements pile up on spikes. For ML-KEM there is no such function to give it, so we gave it a scrambled one seeded with the real ML-KEM public key, and it found nothing. What it does not show: a proof that ML-KEM is unbreakable. Nobody has found a quantum attack on it, which is not the same as proving none exists.</p>

{:else if viz.kind === 'wrongkey'}
  <div class="viz">
    <div class="stack">
      <div class="vb bad"><small>Curve secret</small>Eve broke it</div>
      <div class="vb"><small>ML-KEM secret</small>Eve can only guess</div>
    </div>
    <span class="va"><i>→</i><small>mixed</small></span>
    <div class="vb key"><small>Eve's key</small><span class="mono">{viz.guess}…</span></div>
    <span class="va">≠</span>
    <div class="vb ok"><small>Real key</small><span class="mono">{viz.real}…</span></div>
    <span class="va"><i>→</i><small>AES-256-GCM</small></span>
    <div class="vb ok"><small>Tag check</small>fails ✕</div>
  </div>
  {#if viz.controlOk}
    <p class="vnote">Control test: if Eve also had the real ML-KEM secret, her key would be right and the file would open. So the ML-KEM half is the only thing standing between Eve and the data.</p>
  {/if}
{/if}
