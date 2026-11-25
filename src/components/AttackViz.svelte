<script lang="ts">
  import type { Viz } from '../lib/ui/attack-viz.ts';
  let { viz }: { viz: Viz } = $props();

  // the little boxes ("vb"), arrows ("va") and notes in each diagram
  const VB = 'border rounded-[10px] px-3 py-2 text-center text-[15px] font-semibold max-w-[260px] [word-break:break-word]';
  const SMALL = 'block text-[12px] font-medium text-muted mb-0.5';
  const MONO = 'font-mono text-[13px] font-medium';
  const kinds = {
    plain: 'bg-white border-line', key: 'bg-warn border-warn-line', lock: 'bg-accent-soft border-accent-line text-lock-ink', data: 'bg-panel2 border-line',
    tag: 'bg-violet-soft border-violet-line', bad: 'bg-bad border-bad-line text-bad-ink', ok: 'bg-good border-good-line text-good-ink',
  };

  const VIZ = 'flex flex-wrap items-center gap-2.5 bg-sunken border border-line rounded-xl px-[18px] py-4';
  const VIZ_COL = 'flex flex-col flex-wrap items-stretch gap-2.5 bg-sunken border border-line rounded-xl px-[18px] py-4';
  const VA = 'inline-flex flex-col items-center text-muted text-[18px] leading-[1.1]';
  const ARROW = 'not-italic text-[22px]';
  const VA_SMALL = 'text-[12px] text-muted mt-0.5 text-center max-w-[130px]';
  const NOTE = 'mt-1 mb-0 text-[15px] text-muted leading-[1.55]';
</script>

{#if viz.kind === 'aes'}
  <div class={VIZ}>
    <div class="{VB} min-w-[84px] {kinds.data}"><small class={SMALL}>Your data</small>{viz.plain}</div>
    <span class={VA}>+</span>
    <div class="{VB} min-w-[84px] {kinds.key}"><small class={SMALL}>Random key (256-bit)</small><span class={MONO}>{viz.key}…</span></div>
    <span class={VA}><i class={ARROW}>→</i><small class={VA_SMALL}>AES-256-GCM</small></span>
    <div class="{VB} min-w-[84px] {kinds.data}"><small class={SMALL}>Scrambled data</small><span class={MONO}>{viz.cipher}…</span></div>
    <span class={VA}>+</span>
    <div class="{VB} min-w-[84px] {kinds.tag}"><small class={SMALL}>Tag (16 bytes)</small><span class={MONO}>{viz.tag}…</span></div>
  </div>
  <p class={NOTE}>The tag is a checksum made with the key. Change one bit of the data and the tag no longer matches.</p>

{:else if viz.kind === 'lock'}
  <div class={VIZ_COL}>
    {#each viz.pairs as [b, c], i}
      <div class="flex items-center gap-3 flex-wrap">
        <div class="{VB} min-w-[110px] {kinds.key}"><small class={SMALL}>Key byte {i + 1}</small>{b}</div>
        <span class={VA}><i class={ARROW}>→</i><small class={VA_SMALL}>{b}<sup>{viz.e}</sup> mod {viz.N}</small></span>
        <div class="{VB} min-w-[110px] {kinds.lock}"><small class={SMALL}>Locked</small>{c}</div>
      </div>
    {/each}
    <div class="flex items-center gap-3 flex-wrap text-muted text-[14px] pl-1">… and the same for the other 28 bytes</div>
  </div>
  <p class={NOTE}>Locking is easy for anyone who knows the public key (N and e). Unlocking needs the private key d.</p>

{:else if viz.kind === 'record'}
  <div class={VIZ_COL}>
    <div class="flex items-center justify-center gap-3 flex-wrap">
      <div class="{VB} min-w-[96px] {kinds.plain}">Alice</div>
      <span class={VA}><i class={ARROW}>→</i></span>
      <div class="flex flex-wrap gap-2 border-x-0 border-y-2 border-dashed border-wire px-2.5 py-2">{#each viz.items as item}<span class="bg-panel2 border border-line rounded-md px-[9px] py-1 text-[13px]">{item}</span>{/each}</div>
      <span class={VA}><i class={ARROW}>→</i></span>
      <div class="{VB} min-w-[96px] {kinds.plain}">Bob</div>
    </div>
    <div class="flex flex-col items-center justify-center gap-0.5 flex-wrap">
      <span class={VA}><i class={ARROW}>↓</i><small class="text-[12px] text-muted mt-0.5 text-center">copies everything</small></span>
      <div class="{VB} min-w-[96px] {kinds.bad}">Eve</div>
    </div>
  </div>

{:else if viz.kind === 'factor'}
  <div class={VIZ}>
    <div class="{VB} min-w-[84px] {kinds.lock}"><small class={SMALL}>Public key</small>N = {viz.N}</div>
    <span class={VA}><i class={ARROW}>→</i><small class={VA_SMALL}>Shor ({viz.qubits} qubits)</small></span>
    <div class="{VB} min-w-[84px] {kinds.bad}"><small class={SMALL}>p</small>{viz.p}</div>
    <span class={VA}>×</span>
    <div class="{VB} min-w-[84px] {kinds.bad}"><small class={SMALL}>q</small>{viz.q}</div>
    <span class={VA}><i class={ARROW}>→</i><small class={VA_SMALL}>φ = (p−1)(q−1)</small></span>
    <div class="{VB} min-w-[84px] {kinds.plain}"><small class={SMALL}>φ</small>{viz.phi}</div>
    <span class={VA}><i class={ARROW}>→</i><small class={VA_SMALL}>d = e⁻¹ mod φ</small></span>
    <div class="{VB} min-w-[84px] {kinds.bad}"><small class={SMALL}>Private key d</small>{viz.d}</div>
  </div>
  <p class={NOTE}>Check: e × d = {viz.e} × {viz.d} = {viz.e * viz.d} = {Math.floor((viz.e * viz.d) / viz.phi)} × {viz.phi} + 1. It leaves remainder 1, so d undoes e.</p>

{:else if viz.kind === 'unlock'}
  <div class={VIZ_COL}>
    {#each viz.pairs as [c, b], i}
      <div class="flex items-center gap-3 flex-wrap">
        <div class="{VB} min-w-[110px] {kinds.lock}"><small class={SMALL}>Locked byte {i + 1}</small>{c}</div>
        <span class={VA}><i class={ARROW}>→</i><small class={VA_SMALL}>{c}<sup>{viz.d}</sup> mod {viz.N}</small></span>
        <div class="{VB} min-w-[110px] {kinds.key}"><small class={SMALL}>Key byte</small>{b}</div>
      </div>
    {/each}
    <div class="flex items-center gap-3 flex-wrap text-muted text-[14px] pl-1">… all 32 bytes, so Eve has the AES key, and AES-GCM opens the data</div>
  </div>

{:else if viz.kind === 'mix'}
  <div class={VIZ}>
    <div class="flex flex-col gap-2">
      <div class="{VB} min-w-[84px] {kinds.key}"><small class={SMALL}>Elliptic-curve secret (toy X25519)</small>32 bytes</div>
      <div class="{VB} min-w-[84px] {kinds.key}"><small class={SMALL}>ML-KEM-768 secret (real)</small>32 bytes</div>
    </div>
    <span class={VA}><i class={ARROW}>→</i><small class={VA_SMALL}>mixed (HKDF-SHA256)</small></span>
    <div class="{VB} min-w-[84px] {kinds.key}"><small class={SMALL}>AES-256 key</small><span class={MONO}>{viz.keyHex}…</span></div>
    <span class={VA}><i class={ARROW}>→</i><small class={VA_SMALL}>AES-256-GCM</small></span>
    <div class="{VB} min-w-[84px] {kinds.data}"><small class={SMALL}>Encrypted file</small>+ ML-KEM part ({viz.ctM} B)</div>
  </div>
  <p class={NOTE}>The key depends on both secrets. If either one is wrong, the key comes out completely different.</p>

{:else if viz.kind === 'ecdlp'}
  <div class={VIZ}>
    <div class="{VB} min-w-[84px] {kinds.lock}"><small class={SMALL}>Bob's public point B</small>({viz.B.x}, {viz.B.y})</div>
    <span class={VA}><i class={ARROW}>→</i><small class={VA_SMALL}>Shor ({viz.registerQubits} + {viz.registerQubits} + {viz.pointQubits} qubits)</small></span>
    <div class="{VB} min-w-[84px] {kinds.plain}"><small class={SMALL}>Measured (u, v)</small>({viz.shot.u}, {viz.shot.v})</div>
    <span class={VA}><i class={ARROW}>→</i><small class={VA_SMALL}>k = v ÷ u (mod {viz.curve.n})</small></span>
    <div class="{VB} min-w-[84px] {kinds.bad}"><small class={SMALL}>Bob's secret k</small>{viz.k}</div>
    <span class={VA}><i class={ARROW}>→</i><small class={VA_SMALL}>k × Alice's point</small></span>
    <div class="{VB} min-w-[84px] {kinds.bad}"><small class={SMALL}>Shared secret</small>{viz.matches ? 'recovered ✓' : 'wrong ✕'}</div>
  </div>
  <p class={NOTE}>The toy curve is y² = x³ + {viz.curve.a}x + {viz.curve.b} over the numbers mod {viz.curve.p}, with {viz.curve.n} points. Shor used only the public points. It needed {viz.shotsUsed} measurement{viz.shotsUsed === 1 ? '' : 's'}. The secret k is used only at the end, to check the answer.</p>

{:else if viz.kind === 'spectrum'}
  <div class={VIZ_COL}>
    {#each [viz.loop, viz.noLoop] as s}
      <div class="bg-white border border-line rounded-[10px] px-4 py-3.5">
        <div class="flex justify-between items-baseline gap-3 flex-wrap mb-2">
          <b class="text-[15px]">{s.title}</b>
          <span class="text-[14px] font-semibold px-2.5 py-0.5 rounded-full {s.valid > 0 ? 'bg-bad text-bad-ink' : 'bg-good text-good-ink'}">{s.valid} of {s.shots} shots found a loop</span>
        </div>
        <svg class="block w-full h-[84px] bg-panel2 rounded-md" viewBox="0 0 256 64" preserveAspectRatio="none" role="img" aria-label="chance of each measured value">
          <line x1="0" y1="63.5" x2="256" y2="63.5" stroke="#98a1b3" stroke-width="1" vector-effect="non-scaling-stroke" />
          {#each s.blocks as v, i}
            <rect x={i} y={63 - (v / viz.max) * 58} width="0.85" height={Math.max(0.5, (v / viz.max) * 58)} fill={s.color} />
          {/each}
        </svg>
        <div class="flex justify-between mt-1.5 text-[13px] text-muted"><span>{s.caption}</span><span>measured value k →</span></div>
      </div>
    {/each}
  </div>
  <p class={NOTE}>What this shows: Shor's method only works when a function has a hidden loop. aˣ mod N has one, so the measurements pile up on spikes. For ML-KEM there is no such function to give it, so we gave it a scrambled one seeded with the real ML-KEM public key, and it found nothing. What it does not show: a proof that ML-KEM is unbreakable. Nobody has found a quantum attack on it, which is not the same as proving none exists.</p>

{:else if viz.kind === 'wrongkey'}
  <div class={VIZ}>
    <div class="flex flex-col gap-2">
      <div class="{VB} min-w-[84px] {kinds.bad}"><small class={SMALL}>Curve secret</small>Eve broke it</div>
      <div class="{VB} min-w-[84px] {kinds.plain}"><small class={SMALL}>ML-KEM secret</small>Eve can only guess</div>
    </div>
    <span class={VA}><i class={ARROW}>→</i><small class={VA_SMALL}>mixed</small></span>
    <div class="{VB} min-w-[84px] {kinds.key}"><small class={SMALL}>Eve's key</small><span class={MONO}>{viz.guess}…</span></div>
    <span class={VA}>≠</span>
    <div class="{VB} min-w-[84px] {kinds.ok}"><small class={SMALL}>Real key</small><span class={MONO}>{viz.real}…</span></div>
    <span class={VA}><i class={ARROW}>→</i><small class={VA_SMALL}>AES-256-GCM</small></span>
    <div class="{VB} min-w-[84px] {kinds.ok}"><small class={SMALL}>Tag check</small>fails ✕</div>
  </div>
  {#if viz.controlOk}
    <p class={NOTE}>Control test: if Eve also had the real ML-KEM secret, her key would be right and the file would open. So the ML-KEM half is the only thing standing between Eve and the data.</p>
  {/if}
{/if}
