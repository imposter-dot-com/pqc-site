<script lang="ts">
  import { onMount } from 'svelte';
  import { initSimulator, runMath } from '../lib/simulator.ts';
  let more = $state(false);
  let learn = $state(false);

  // the step-by-step guide shows the run one step at a time
  const STEPS: Array<{ panel: number; tab?: number; title: string; text: string; math?: () => string | null }> = [
    { panel: 4, title: 'The circuit', text: 'Read it left to right: try every x at once, compute a<sup>x</sup> mod N, spot the pattern with the QFT, then measure.' },
    { panel: 5, title: 'The pattern', text: 'Keep multiplying by a (mod N) and the remainders loop. The number of steps until you are back at 1 is the loop length, called r.' },
    { panel: 6, tab: 0, title: 'Try every x', text: 'Every x is equally likely. The quantum computer holds them all at once.' },
    { panel: 6, tab: 1, title: 'Compute a<sup>x</sup> mod N', text: 'We measure one answer. Only the x values that gave it are left, evenly spaced by r.' },
    { panel: 6, tab: 2, title: 'The QFT', text: 'The QFT turns that even spacing into tall spikes. The spikes give away r.' },
    { panel: 6, tab: 3, title: 'Measure', text: 'Each measurement lands near a spike. Noise makes the result blurrier.' },
    { panel: 7, title: 'Find the period', text: 'Each measurement is a fraction. Simplifying it gives a guess for r. A guess is good if a<sup>r</sup> mod N = 1.', math: () => { const m = runMath(); return m ? `Here r = ${m.r}, so a<sup>${m.r}</sup> mod ${m.N} = 1 with a = ${m.a}. Next we only need half of it: a<sup>${m.half}</sup> mod ${m.N} = ${m.h}.` : null; } },
    { panel: 8, title: 'Result', text: 'With r we get the two prime factors of N, then the private key. The message decrypts: the key is broken.', math: () => { const m = runMath(); return m ? `gcd(${m.h} − 1, ${m.N}) = ${m.g1} and gcd(${m.h} + 1, ${m.N}) = ${m.g2}, so ${m.N} = ${m.p} × ${m.q}. Then φ = (${m.p}−1)(${m.q}−1) = ${m.phi}, and the private key is d = e⁻¹ mod φ = ${m.d}. Each letter decrypts as c<sup>${m.d}</sup> mod ${m.N}.` : null; } },
  ];
  function closeLearn(): void { learn = false; try { localStorage.setItem('shorIntroSeen', '1'); } catch {
      // storage can be blocked, that's ok
    } }
  let walk = $state(false);
  let step = $state(0);
  const shown = (n: number): boolean => STEPS.findIndex(s => s.panel === n) <= step;
  const st = (n: number): string => !walk ? '' : !shown(n) ? 'pending' : STEPS[step]!.panel === n ? 'current' : '';
  function goTo(i: number): void {
    step = Math.max(0, Math.min(STEPS.length - 1, i));
    const t = STEPS[step]!.tab;
    if (t !== undefined) (document.querySelectorAll('#tabs button')[t] as HTMLButtonElement | undefined)?.click();
    requestAnimationFrame(() => document.querySelector('.panel.current')?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
  }
  function onKey(e: KeyboardEvent): void {
    if (!walk || (e.target as HTMLElement).closest('input,select,textarea')) return;
    if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); goTo(step + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(step - 1); }
  }

  onMount(() => {
    initSimulator();
    try { if (!localStorage.getItem('shorIntroSeen')) learn = true; } catch {
      // storage can be blocked, that's ok
    }
    const go = document.getElementById('go')!;
    go.addEventListener('click', () => { walk = true; goTo(0); });
    const reset = () => { walk = false; };
    for (const id of ['preset', 'cp', 'cq', 'msg', 'aSel', 'shots', 'readout', 'depol']) document.getElementById(id)?.addEventListener('change', reset);
    window.addEventListener('keydown', onKey);
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLearn(); });
    return () => window.removeEventListener('keydown', onKey);
  });
</script>

<div class="topbtns"><button class="morebtn" onclick={() => learn = true}>? How does this break RSA?</button><button class="morebtn" onclick={() => more = true}>Noise sweep &amp; RSA-2048 check</button></div>
<main class="grid">
  <!-- the key and the quantum settings -->
  <div class="col side">
    <div class="panel">
      <h2>Pick an RSA key</h2>
      <label for="preset">Primes p &times; q</label>
      <select id="preset"></select>
      <div id="customBox" style="display:none">
        <div class="row"><input id="cp" type="number" min="2" value="13" aria-label="prime p"><input id="cq" type="number" min="2" value="29" aria-label="prime q"></div>
        <div class="caption">Two different primes, N = p&times;q between 27 and 511.</div>
      </div>
      <div class="row"><div><label>Public key</label>
      <div class="mono field" id="pubkey"></div></div>
      <div><label>Private key d</label>
      <div class="mono field" id="privkey">hidden</div></div></div>
      <label for="msg">Message (letters A-Z)</label>
      <input id="msg" type="text" value="HELLO" maxlength="24">
      <label>Ciphertext</label>
      <div class="mono field" id="cipher"></div>
    </div>

    <div class="panel">
      <div class="panel-head"><h2>Quantum settings</h2><button class="run" id="go" title="Run the attack"><svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M2 1 L11 6 L2 11 Z" fill="currentColor"/></svg>Run</button></div>
      <label for="aSel">Base a (coprime to N)</label>
      <select id="aSel"></select>
      <label for="shots">Shots per attempt: <span id="shotsV">12</span></label>
      <input id="shots" type="range" min="1" max="60" value="12">
      <label for="readout">Readout noise: <span id="readoutV">0</span>%</label>
      <input id="readout" type="range" min="0" max="20" step="0.5" value="0">
      <label for="depol">Depolarizing noise: <span id="depolV">0</span>%</label>
      <input id="depol" type="range" min="0" max="100" step="1" value="0">
      
    </div>
  </div>

  <!-- the steps of the break, then the outcome -->
  <div class="main">
  <div class="quad">
    {#if walk}
      <div class="walk">
        <div class="walk-info">
          <div class="walk-head"><span>Guide · step {step + 1} of {STEPS.length}</span><button class="link" onclick={() => (walk = false)}>Show all</button><small>or use ← →</small></div>
          <b>{@html STEPS[step]!.title}</b> <span>{@html STEPS[step]!.text}</span>
          {#if STEPS[step]!.math?.()}<div class="mathline mono">{@html STEPS[step]!.math!()}</div>{/if}
        </div>
        <div class="walk-btns"><button onclick={() => goTo(step - 1)} disabled={step === 0}>← Back</button><button class="next" onclick={() => goTo(step + 1)} disabled={step === STEPS.length - 1}>Next →</button></div>
      </div>
    {/if}
    <div class="panel wide {st(4)}">
      <h2><span class="num">1</span>The quantum circuit</h2>
      <div id="circuit"></div>
      <div class="caption" id="circCap"></div>
    </div>
    <div class="panel {st(5)}">
      <h2><span class="num">2</span>The pattern a<sup>x</sup> mod N repeats</h2>
      <div class="chartbox"><canvas id="fx"></canvas></div>
      <div class="caption" id="fxCap">Run the attack to see the period.</div>
    </div>
    <div class="panel {st(6)}">
      <h2><span class="num">3</span>The counting register</h2>
      <div class="tabs" id="tabs"></div>
      <div class="chartbox tall"><canvas id="hist"></canvas></div>
      <div class="caption" id="histCap"></div>
    </div>
    <div class="panel wide {st(7)}">
      <h2><span class="num">4</span>Find the period</h2>
      <div class="tbl"><table id="shotTbl"><thead><tr><th>#</th><th>k</th><th>k / Q</th><th>fractions</th><th>r (guess)</th><th></th></tr></thead><tbody></tbody></table></div>
      <div class="caption">k = what we measured, r = our guess for the loop length. A guess is good if a<sup>r</sup> mod N = 1.</div>
    </div>
  </div>

  <div class="outcome">
    <div class="panel {st(8)}">
      <h2><span class="num">5</span>Outcome</h2>
      <div class="status secure" id="status">Secure<small>No attack run yet.</small></div>
      <label>Decrypted message</label>
      <div class="decrypted mono" id="dec">Ciphertext is unreadable without the private key d.</div>
    </div>
    <div class="panel {st(8)}">
      <h2>Attack summary</h2>
      <div class="kv">
        <div><b>N</b><span id="kN">-</span></div>
        <div><b>Base a</b><span id="kA">-</span></div>
        <div><b>Loop length r</b><span id="kR">-</span></div>
        <div><b>Factors</b><span id="kF">-</span></div>
        <div><b>Qubits</b><span id="kQ">-</span></div>
        <div><b>Tries / shots</b><span id="kT">-</span></div>
      </div>
    </div>
    <div class="panel logp {st(8)}">
      <h2>Log</h2>
      <div class="term mono" id="log"></div>
    </div>
  </div>
  </div>
</main>

<div class="overlay" class:open={more} onclick={(e) => { if (e.target === e.currentTarget) more = false; }} role="presentation">
<section class="modal">
  <button class="close" onclick={() => more = false} aria-label="Close">&times;</button>
  <div class="panel flat">
    <h2>Noise sweep: how often one shot still works</h2>
    <div class="row">
      <select id="sweepKind"><option value="readout">Sweep readout noise (0-20%)</option><option value="depol">Sweep depolarizing noise (0-100%)</option></select>
      <button id="sweep">Run noise sweep</button>
    </div>
    <div class="chartbox short"><canvas id="sweepC"></canvas></div>
    <div class="legend"><span><i style="background:var(--cyan)"></i>success rate of one shot</span><span><i style="background:var(--amber)"></i>guessing baseline (output fully random)</span></div>
    <div class="caption" id="sweepCap">400 shots per point on the current N and a. For very small N a random guess also works often, which is why the baseline is drawn.</div>
  </div>
  <div class="panel flat">
    <h2>Toy key vs. RSA-2048</h2>
    <div class="kv">
      <div><b>This simulation</b><span id="rcSim">-</span></div>
      <div><b>RSA-2048 (estimate)</b><span>&lt; 1 million noisy qubits</span></div>
    </div>
    <p class="caption">Gidney (2025) estimates RSA-2048 could be factored with under a million noisy qubits in under a week (arXiv:2505.15917). Today's devices have only a few thousand, so it isn't possible yet. But data recorded now can be decrypted later ("harvest now, decrypt later"). This simulator doubles its memory with every qubit, so it stops at about 25-30 qubits.</p>
    
  </div>
</section>
</div>

<div class="overlay" class:open={learn} onclick={(e) => { if (e.target === e.currentTarget) closeLearn(); }} role="presentation">
  <section class="modal learn">
    <button class="close" onclick={closeLearn} aria-label="Close">&times;</button>
    <h2>How can a quantum computer break RSA?</h2>
    <ol class="idea">
      <li><span class="num">1</span><div><b>RSA's lock is a big number.</b> The public key contains N = p × q, two secret prime numbers multiplied together (for example 5 × 13 = 65). Everyone can see N. Only someone who knows p and q can work out the private key. With 600-digit numbers, nobody can find p and q today.</div></li>
      <li><span class="num">2</span><div><b>So breaking RSA means finding p and q.</b> That is called factoring. A normal computer has to try numbers one by one, which would take longer than the age of the universe.</div></li>
      <li><span class="num">3</span><div><b>Shor's trick: look for a repeating pattern.</b> Pick a number a. Keep multiplying by a and keep only the remainder after dividing by N. The results always loop back to 1. The number of steps in the loop is the period r. A normal computer struggles to find r, but a quantum computer can try every step at once and spot the pattern.</div></li>
      <li><span class="num">4</span><div><b>The pattern reveals the factors.</b> Once r is known, a bit of school maths (gcd) turns it into p and q. From p and q you get the private key, and every message can be read.</div></li>
    </ol>
    <div class="example">
      <b>Tiny example: N = 15, a = 7</b>
      <div class="chips mono"><span>7¹ → 7</span><span>7² → 4</span><span>7³ → 13</span><span>7⁴ → 1 ↺</span></div>
      <p>The loop length is <b>r = 4</b>. Half of it: 7² mod 15 = 4. Then gcd(4 − 1, 15) = <b>3</b> and gcd(4 + 1, 15) = <b>5</b>. So 15 = 3 × 5. Key broken.</p>
    </div>
    <p class="caption">The simulator does exactly this on a small N. Press <b>Run the attack</b>, then follow the guide to see each step with real numbers.</p>
    <button class="primary" onclick={closeLearn}>Got it, let's start</button>
  </section>
</div>
