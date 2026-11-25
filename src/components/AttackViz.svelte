<script lang="ts">
  import type { Viz } from '../lib/ui/attack-viz.ts';
  import { vizStyles as css } from '../styles/attack-viz.ts';
  let { viz }: { viz: Viz } = $props();
</script>

{#if viz.kind === 'aes'}
  <div class={css.row}>
    <div class="{css.box} min-w-[84px] {css.kind.data}"><small class={css.label}>Your data</small>{viz.plain}</div>
    <span class={css.arrow}>+</span>
    <div class="{css.box} min-w-[84px] {css.kind.key}"><small class={css.label}>Random key (256-bit)</small><span class={css.mono}>{viz.key}…</span></div>
    <span class={css.arrow}><i class={css.arrowIcon}>→</i><small class={css.arrowLabel}>AES-256-GCM</small></span>
    <div class="{css.box} min-w-[84px] {css.kind.data}"><small class={css.label}>Scrambled data</small><span class={css.mono}>{viz.cipher}…</span></div>
    <span class={css.arrow}>+</span>
    <div class="{css.box} min-w-[84px] {css.kind.tag}"><small class={css.label}>Tag (16 bytes)</small><span class={css.mono}>{viz.tag}…</span></div>
  </div>
  <p class={css.note}>The tag is a checksum made with the key. Change one bit of the data and the tag no longer matches.</p>

{:else if viz.kind === 'lock'}
  <div class={css.column}>
    {#each viz.pairs as [b, c], i}
      <div class={css.lockRow}>
        <div class="{css.box} min-w-[110px] {css.kind.key}"><small class={css.label}>Key byte {i + 1}</small>{b}</div>
        <span class={css.arrow}><i class={css.arrowIcon}>→</i><small class={css.arrowLabel}>{b}<sup>{viz.e}</sup> mod {viz.N}</small></span>
        <div class="{css.box} min-w-[110px] {css.kind.lock}"><small class={css.label}>Locked</small>{c}</div>
      </div>
    {/each}
    <div class={css.lockMore}>… and the same for the other 28 bytes</div>
  </div>
  <p class={css.note}>Locking is easy for anyone who knows the public key (N and e). Unlocking needs the private key d.</p>

{:else if viz.kind === 'record'}
  <div class={css.column}>
    <div class={css.transferRow}>
      <div class="{css.box} min-w-[96px] {css.kind.plain}">Alice</div>
      <span class={css.arrow}><i class={css.arrowIcon}>→</i></span>
      <div class={css.wire}>{#each viz.items as item}<span class={css.packet}>{item}</span>{/each}</div>
      <span class={css.arrow}><i class={css.arrowIcon}>→</i></span>
      <div class="{css.box} min-w-[96px] {css.kind.plain}">Bob</div>
    </div>
    <div class={css.eveColumn}>
      <span class={css.arrow}><i class={css.arrowIcon}>↓</i><small class={css.eveLabel}>copies everything</small></span>
      <div class="{css.box} min-w-[96px] {css.kind.bad}">Eve</div>
    </div>
  </div>

{:else if viz.kind === 'factor'}
  <div class={css.row}>
    <div class="{css.box} min-w-[84px] {css.kind.lock}"><small class={css.label}>Public key</small>N = {viz.N}</div>
    <span class={css.arrow}><i class={css.arrowIcon}>→</i><small class={css.arrowLabel}>Shor ({viz.qubits} qubits)</small></span>
    <div class="{css.box} min-w-[84px] {css.kind.bad}"><small class={css.label}>p</small>{viz.p}</div>
    <span class={css.arrow}>×</span>
    <div class="{css.box} min-w-[84px] {css.kind.bad}"><small class={css.label}>q</small>{viz.q}</div>
    <span class={css.arrow}><i class={css.arrowIcon}>→</i><small class={css.arrowLabel}>φ = (p−1)(q−1)</small></span>
    <div class="{css.box} min-w-[84px] {css.kind.plain}"><small class={css.label}>φ</small>{viz.phi}</div>
    <span class={css.arrow}><i class={css.arrowIcon}>→</i><small class={css.arrowLabel}>d = e⁻¹ mod φ</small></span>
    <div class="{css.box} min-w-[84px] {css.kind.bad}"><small class={css.label}>Private key d</small>{viz.d}</div>
  </div>
  <p class={css.note}>Check: e × d = {viz.e} × {viz.d} = {viz.e * viz.d} = {Math.floor((viz.e * viz.d) / viz.phi)} × {viz.phi} + 1. It leaves remainder 1, so d undoes e.</p>

{:else if viz.kind === 'unlock'}
  <div class={css.column}>
    {#each viz.pairs as [c, b], i}
      <div class={css.lockRow}>
        <div class="{css.box} min-w-[110px] {css.kind.lock}"><small class={css.label}>Locked byte {i + 1}</small>{c}</div>
        <span class={css.arrow}><i class={css.arrowIcon}>→</i><small class={css.arrowLabel}>{c}<sup>{viz.d}</sup> mod {viz.N}</small></span>
        <div class="{css.box} min-w-[110px] {css.kind.key}"><small class={css.label}>Key byte</small>{b}</div>
      </div>
    {/each}
    <div class={css.lockMore}>… all 32 bytes, so Eve has the AES key, and AES-GCM opens the data</div>
  </div>

{:else if viz.kind === 'mix'}
  <div class={css.row}>
    <div class={css.stack}>
      <div class="{css.box} min-w-[84px] {css.kind.key}"><small class={css.label}>Elliptic-curve secret (toy X25519)</small>32 bytes</div>
      <div class="{css.box} min-w-[84px] {css.kind.key}"><small class={css.label}>ML-KEM-768 secret (real)</small>32 bytes</div>
    </div>
    <span class={css.arrow}><i class={css.arrowIcon}>→</i><small class={css.arrowLabel}>mixed (HKDF-SHA256)</small></span>
    <div class="{css.box} min-w-[84px] {css.kind.key}"><small class={css.label}>AES-256 key</small><span class={css.mono}>{viz.keyHex}…</span></div>
    <span class={css.arrow}><i class={css.arrowIcon}>→</i><small class={css.arrowLabel}>AES-256-GCM</small></span>
    <div class="{css.box} min-w-[84px] {css.kind.data}"><small class={css.label}>Encrypted file</small>+ ML-KEM part ({viz.ctM} B)</div>
  </div>
  <p class={css.note}>The key depends on both secrets. If either one is wrong, the key comes out completely different.</p>

{:else if viz.kind === 'ecdlp'}
  <div class={css.row}>
    <div class="{css.box} min-w-[84px] {css.kind.lock}"><small class={css.label}>Bob's public point B</small>({viz.B.x}, {viz.B.y})</div>
    <span class={css.arrow}><i class={css.arrowIcon}>→</i><small class={css.arrowLabel}>Shor ({viz.registerQubits} + {viz.registerQubits} + {viz.pointQubits} qubits)</small></span>
    <div class="{css.box} min-w-[84px] {css.kind.plain}"><small class={css.label}>Measured (u, v)</small>({viz.shot.u}, {viz.shot.v})</div>
    <span class={css.arrow}><i class={css.arrowIcon}>→</i><small class={css.arrowLabel}>k = v ÷ u (mod {viz.curve.n})</small></span>
    <div class="{css.box} min-w-[84px] {css.kind.bad}"><small class={css.label}>Bob's secret k</small>{viz.k}</div>
    <span class={css.arrow}><i class={css.arrowIcon}>→</i><small class={css.arrowLabel}>k × Alice's point</small></span>
    <div class="{css.box} min-w-[84px] {css.kind.bad}"><small class={css.label}>Shared secret</small>{viz.matches ? 'recovered ✓' : 'wrong ✕'}</div>
  </div>
  <p class={css.note}>The toy curve is y² = x³ + {viz.curve.a}x + {viz.curve.b} over the numbers mod {viz.curve.p}, with {viz.curve.n} points. Shor used only the public points. It needed {viz.shotsUsed} measurement{viz.shotsUsed === 1 ? '' : 's'}. The secret k is used only at the end, to check the answer.</p>

{:else if viz.kind === 'spectrum'}
  <div class={css.column}>
    {#each [viz.loop, viz.noLoop] as s}
      <div class={css.spectrumCard}>
        <div class={css.spectrumHead}>
          <b class="text-[15px]">{s.title}</b>
          <span class="{css.score} {s.valid > 0 ? css.scoreBad : css.scoreGood}">{s.valid} of {s.shots} shots found a loop</span>
        </div>
        <svg class={css.spectrumChart} viewBox="0 0 256 64" preserveAspectRatio="none" role="img" aria-label="chance of each measured value">
          <line x1="0" y1="63.5" x2="256" y2="63.5" stroke="#98a1b3" stroke-width="1" vector-effect="non-scaling-stroke" />
          {#each s.blocks as v, i}
            <rect x={i} y={63 - (v / viz.max) * 58} width="0.85" height={Math.max(0.5, (v / viz.max) * 58)} fill={s.color} />
          {/each}
        </svg>
        <div class={css.spectrumAxis}><span>{s.caption}</span><span>measured value k →</span></div>
      </div>
    {/each}
  </div>
  <p class={css.note}>What this shows: Shor's method only works when a function has a hidden loop. aˣ mod N has one, so the measurements pile up on spikes. For ML-KEM there is no such function to give it, so we gave it a scrambled one seeded with the real ML-KEM public key, and it found nothing. What it does not show: a proof that ML-KEM is unbreakable. Nobody has found a quantum attack on it, which is not the same as proving none exists.</p>

{:else if viz.kind === 'wrongkey'}
  <div class={css.row}>
    <div class={css.stack}>
      <div class="{css.box} min-w-[84px] {css.kind.bad}"><small class={css.label}>Curve secret</small>Eve broke it</div>
      <div class="{css.box} min-w-[84px] {css.kind.plain}"><small class={css.label}>ML-KEM secret</small>Eve can only guess</div>
    </div>
    <span class={css.arrow}><i class={css.arrowIcon}>→</i><small class={css.arrowLabel}>mixed</small></span>
    <div class="{css.box} min-w-[84px] {css.kind.key}"><small class={css.label}>Eve's key</small><span class={css.mono}>{viz.guess}…</span></div>
    <span class={css.arrow}>≠</span>
    <div class="{css.box} min-w-[84px] {css.kind.ok}"><small class={css.label}>Real key</small><span class={css.mono}>{viz.real}…</span></div>
    <span class={css.arrow}><i class={css.arrowIcon}>→</i><small class={css.arrowLabel}>AES-256-GCM</small></span>
    <div class="{css.box} min-w-[84px] {css.kind.ok}"><small class={css.label}>Tag check</small>fails ✕</div>
  </div>
  {#if viz.controlOk}
    <p class={css.note}>Control test: if Eve also had the real ML-KEM secret, her key would be right and the file would open. So the ML-KEM half is the only thing standing between Eve and the data.</p>
  {/if}
{/if}
