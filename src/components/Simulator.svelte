<script lang="ts">
  import { onMount } from 'svelte';
  import { initSimulator, runMath } from '../lib/ui/simulator.ts';
  import { shared } from '../styles/shared.ts';
  import { simulatorStyles as css } from '../styles/simulator.ts';
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
    { panel: 8, title: 'Result', text: 'With r we get the two prime factors of N, then the private key. The private key unlocks the secret key, and that key opens the message: RSA is broken.', math: () => { const m = runMath(); return m ? `<b>Half the loop:</b> r = ${m.r}, so a<sup>${m.half}</sup> mod ${m.N} = ${m.h}.<br><b>gcd:</b> gcd(${m.h} − 1, ${m.N}) = ${m.g1} and gcd(${m.h} + 1, ${m.N}) = ${m.g2}, so ${m.N} = ${m.p} × ${m.q}.<br><b>φ:</b> (${m.p} − 1) × (${m.q} − 1) = ${m.p - 1} × ${m.q - 1} = ${m.phi}.<br><b>d:</b> we need ${m.e} × d to leave remainder 1 after dividing by ${m.phi}. The numbers that leave remainder 1 are ${m.remainderOne} (start at 1 and add ${m.phi} each time). The first one that ${m.e} divides evenly is ${m.e * m.d}, and ${m.e * m.d} ÷ ${m.e} = ${m.d}, so d = ${m.d}. (Check: ${m.e} × ${m.d} = ${m.e * m.d} = ${Math.floor((m.e * m.d) / m.phi)} × ${m.phi} + 1.)<br><b>Unlock:</b> each number c of the locked key becomes c<sup>${m.d}</sup> mod ${m.N}.` : null; } },
  ];
  function closeLearn(): void { learn = false; try { localStorage.setItem('shorIntroSeen', '1'); } catch {
      // storage can be blocked, that's ok
    } }
  let walk = $state(false);
  let step = $state(0);
  const shown = (n: number): boolean => STEPS.findIndex(s => s.panel === n) <= step;
  const isCurrent = (n: number): boolean => walk && shown(n) && STEPS[step]!.panel === n;
  // while the guide is open, later panels are faded and the current one is outlined
  const st = (n: number): string => !walk ? '' : !shown(n) ? css.guidePending : isCurrent(n) ? css.guideCurrent : '';
  function goTo(i: number): void {
    step = Math.max(0, Math.min(STEPS.length - 1, i));
    const t = STEPS[step]!.tab;
    if (t !== undefined) (document.querySelectorAll('#tabs button')[t] as HTMLButtonElement | undefined)?.click();
    requestAnimationFrame(() => document.querySelector('[data-current]')?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
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
    for (const id of ['preset', 'cp', 'cq', 'msg', 'aSel', 'simMode', 'noisePreset', 'readout', 'gate2']) document.getElementById(id)?.addEventListener('change', reset);
    window.addEventListener('keydown', onKey);
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLearn(); });
    return () => window.removeEventListener('keydown', onKey);
  });
</script>

<div class={css.topButtons}><button class={css.topButton} onclick={() => learn = true}>? How does this break RSA?</button><button class={css.topButton} onclick={() => more = true}>Toy vs real hardware</button></div>
<main class={css.page}>
  <!-- the key and the quantum settings -->
  <div class={css.controls}>
    <div class={shared.sidePanel}>
      <h2 class={css.keyTitle}>Pick an RSA key</h2>
      <label class={shared.sideLabel} for="preset">Primes p &times; q</label>
      <select id="preset"></select>
      <div id="customBox" style="display:none">
        <div class={shared.row}><input id="cp" type="number" min="2" value="13" aria-label="prime p"><input id="cq" type="number" min="2" value="29" aria-label="prime q"></div>
        <div class={shared.caption}>Two different primes, N = p&times;q between 27 and 511.</div>
      </div>
      <div class={shared.row}><div><label class={shared.sideLabel}>Public key</label>
      <div class={shared.monoField} id="pubkey"></div></div>
      <div><label class={shared.sideLabel}>Private key d</label>
      <div class={shared.monoField} id="privkey">hidden</div></div></div>
      <label class={shared.sideLabel} for="msg">Message or file (letters A-Z)</label>
      <input id="msg" type="text" value="HELLO" maxlength="24">
      <label class={shared.sideLabel}>Key that locks the message (locked with RSA)</label>
      <div class={shared.monoField} id="lockedKey"></div>
      <div class={shared.caption}>The message is locked with a secret key. RSA only locks that key. Shor breaks the RSA lock, then the key opens the message.</div>
    </div>

    <div class={shared.sidePanel}>
      <div class={css.settingsHead}><h2 class={css.settingsTitle}>Quantum settings</h2><button class={css.runButton} id="go" title="Run the attack"><svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M2 1 L11 6 L2 11 Z" fill="currentColor"/></svg>Run</button></div>
      <label class={shared.sideLabel} for="simMode">The a<sup>x</sup> mod N step is</label>
      <select id="simMode"><option value="fast">Computed directly (fast)</option><option value="full">Built from gates (slow, N up to 143)</option></select>
      <div class={shared.caption} id="simModeCap">Built from gates, noise can hit the a<sup>x</sup> mod N step too. Computed directly, only the QFT has gate noise.</div>
      <label class={shared.sideLabel} for="noisePreset">Noise level</label>
      <select id="noisePreset"></select>
      <label class={shared.sideLabel} for="readout">Readout noise: <span id="readoutV">0</span>%</label>
      <input class="my-0.5" id="readout" type="range" min="0" max="20" step="0.1" value="0">
      <label class={shared.sideLabel} for="gate2">Two-qubit gate error: <span id="gate2V">0</span>%</label>
      <input class="my-0.5" id="gate2" type="range" min="0" max="3" step="0.01" value="0">
      <div class={shared.caption}>Readout noise: the chance each measured bit is read wrong. Two-qubit gate error: the chance each two-qubit gate fails.</div>
      <details class="mt-3.5">
        <summary class="font-medium">Advanced settings</summary>
        <label class={shared.sideLabel} for="aSel">Base a (coprime to N)</label>
        <select id="aSel"></select>
        <div class={shared.caption}>Random picks a base that works. Pick your own to see why some bases fail.</div>
      </details>
      
    </div>
  </div>

  <!-- the steps of the break, then the outcome -->
  <div class={css.content}>
  <div class={css.quad}>
    {#if walk}
      <div class={css.guideBar}>
        <div class={css.guideInfo}>
          <div class={css.guideHead}><span>Guide · step {step + 1} of {STEPS.length}</span><button class={css.guideLink} onclick={() => (walk = false)}>Show all</button><small class={css.guideHint}>or use ← →</small></div>
          <b class={css.guideTitle}>{@html STEPS[step]!.title}</b> <span>{@html STEPS[step]!.text}</span>
          {#if STEPS[step]!.math?.()}<div class={css.guideMath}>{@html STEPS[step]!.math!()}</div>{/if}
        </div>
        <div class={css.guideButtons}><button class={css.guideButton} onclick={() => goTo(step - 1)} disabled={step === 0}>← Back</button><button class={css.guideNext} onclick={() => goTo(step + 1)} disabled={step === STEPS.length - 1}>Next →</button></div>
      </div>
    {/if}
    <div class="{css.widePanel} {st(4)}" data-current={isCurrent(4) ? '' : undefined}>
      <h2 class={shared.panelTitle}><span class={shared.num}>1</span>The quantum circuit</h2>
      <div id="circuit" class={css.circuitSvg}></div>
      <div class={shared.caption} id="circCap"></div>
    </div>
    <div class="{shared.panel} {st(5)}" data-current={isCurrent(5) ? '' : undefined}>
      <h2 class={shared.panelTitle}><span class={shared.num}>2</span>The pattern a<sup>x</sup> mod N repeats</h2>
      <div class={shared.chartFx}><canvas id="fx"></canvas></div>
      <div class={shared.caption} id="fxCap">Press Run to see the period.</div>
    </div>
    <div class="{shared.panel} {st(6)}" data-current={isCurrent(6) ? '' : undefined}>
      <h2 class={shared.panelTitle}><span class={shared.num}>3</span>The counting register</h2>
      <div class={css.tabs} id="tabs"></div>
      <div class={shared.chartHist}><canvas id="hist"></canvas></div>
      <div class={shared.caption} id="histCap"></div>
    </div>
    <div class="{css.widePanel} {st(7)}" data-current={isCurrent(7) ? '' : undefined}>
      <h2 class={shared.panelTitle}><span class={shared.num}>4</span>Find the period</h2>
      <div class={shared.tableBox}><table id="shotTbl"><thead><tr><th>#</th><th>k</th><th>k / Q</th><th>fractions</th><th>r (guess)</th><th>gate errors</th><th></th></tr></thead><tbody></tbody></table></div>
      <div class={shared.caption}>k = what we measured, r = our guess for the loop length. A guess is good if a<sup>r</sup> mod N = 1. Gate errors = how many gates failed in that shot (only when gate noise is on). We run 12 shots per attempt (10 when the a<sup>x</sup> mod N step is built from gates, which is slower). One shot only hints at r and can be useless or hit by noise, so we repeat it and keep the best valid r.</div>
    </div>
  </div>

  <div class={css.quad}>
    <div class="{shared.panel} {st(8)}" data-current={isCurrent(8) ? '' : undefined}>
      <h2 class={shared.panelTitle}><span class={shared.num}>5</span>Outcome</h2>
      <div class="{shared.status.base} {shared.status.secure}" id="status">Secure<small class={shared.statusSmall}>No attack run yet.</small></div>
      <label>How Eve gets the message</label>
      <div class={css.message} id="dec">The message is locked with a key, and that key is locked with RSA. Without d, Eve cannot get the key.</div>
    </div>
    <div class="{shared.panel} {st(8)}" data-current={isCurrent(8) ? '' : undefined}>
      <h2 class={shared.panelTitle}>Attack summary</h2>
      <div class={css.summaryTiles}>
        <div class={shared.kvCell}><b class={shared.kvLabel}>Base a</b><span class={shared.kvValue} id="kA">-</span></div>
        <div class={shared.kvCell}><b class={shared.kvLabel}>Loop length r</b><span class={shared.kvValue} id="kR">-</span></div>
        <div class={shared.kvCell}><b class={shared.kvLabel}>Valid shots</b><span class={shared.kvValue} id="kT">-</span></div>
      </div>
    </div>
  </div>
  </div>
</main>

<div class="{shared.overlay} {more ? 'flex' : 'hidden'}" onclick={(e) => { if (e.target === e.currentTarget) more = false; }} role="presentation">
<section class={css.popup}>
  <button class={css.closeRight} onclick={() => more = false} aria-label="Close">&times;</button>
  <div class={shared.modalPanel}>
    <h2 class={shared.panelTitle}>Toy key vs. RSA-2048</h2>
    <div class={shared.kv}>
      <div class={shared.kvCell}><b class={shared.kvLabel}>This simulation</b><span class={shared.kvValue} id="rcSim">-</span></div>
      <div class={shared.kvCell}><b class={shared.kvLabel}>RSA-2048 (estimate)</b><span class={shared.kvValue}>&lt; 1 million noisy qubits</span></div>
    </div>
    <p class={css.popupCaption}>Gidney (2025) [1] estimates RSA-2048 could be factored with Shor's algorithm [5] using under a million noisy qubits in under a week. Today's devices have only a few thousand, so it isn't possible yet. But data recorded now can be decrypted later ("harvest now, decrypt later"). The QFT's state vector doubles with every counting qubit, so this simulator stops at N = 511 (18 counting qubits).</p>
  </div>
  <div class={shared.modalPanel}>
    <h2 class={shared.panelTitle}>What real IBM hardware noise would do to this circuit</h2>
    <p class={css.popupIntro} id="hwIntro"></p>
    <div class={shared.tableBox}><table id="hwTbl" class={css.hardwareTable}></table></div>
    <p class={css.popupCaption} id="hwNote"></p>
  </div>
  <div class={shared.modalPanel}>
    <h2 class={shared.panelTitle}>Sources</h2>
    <ol class={css.sources}>
      <li>C. Gidney, <i>How to factor 2048 bit RSA integers with less than a million noisy qubits</i>, 2025. <a class={css.sourceLink} target="_blank" rel="noopener noreferrer" href="https://arxiv.org/abs/2505.15917">arXiv:2505.15917</a></li>
      <li>IBM error rates: the median readout, one-qubit and two-qubit gate errors from the calibration snapshots of IBM Fez and Marrakesh (Heron r2, 26 Feb 2025) and Sherbrooke, Brisbane and Osaka (Eagle, 2025 and 2024). They ship with the <a class={css.sourceLink} target="_blank" rel="noopener noreferrer" href="https://github.com/Qiskit/qiskit-ibm-runtime">qiskit-ibm-runtime</a> package (Apache 2.0) as <span class="font-mono">fake_provider/backends/*/props_*.json</span>. We average each chip family. See <span class="font-mono">src/lib/noise/ibm-noise.ts</span> to check them.</li>
      <li>M. Nielsen and I. Chuang, <i>Quantum Computation and Quantum Information</i>, Cambridge University Press, 2000. A Toffoli gate takes 6 CNOT gates.</li>
      <li>V. Vedral, A. Barenco and A. Ekert, <i>Quantum networks for elementary arithmetic operations</i>, Physical Review A 54, 147 (1996). <a class={css.sourceLink} target="_blank" rel="noopener noreferrer" href="https://arxiv.org/abs/quant-ph/9511018">arXiv:quant-ph/9511018</a>. This is the adder our full circuit is built from.</li>
      <li>P. Shor, <i>Polynomial-time algorithms for prime factorization and discrete logarithms on a quantum computer</i>, SIAM Journal on Computing 26(5), 1997. <a class={css.sourceLink} target="_blank" rel="noopener noreferrer" href="https://arxiv.org/abs/quant-ph/9508027">arXiv:quant-ph/9508027</a></li>
    </ol>
  </div>
</section>
</div>

<div class="{shared.overlay} {learn ? 'flex' : 'hidden'}" onclick={(e) => { if (e.target === e.currentTarget) closeLearn(); }} role="presentation">
  <section class={css.explainerPopup}>
    <button class={css.closeLearn} onclick={closeLearn} aria-label="Close">&times;</button>
    <h2 class={css.explainerTitle}>How can a quantum computer break RSA?</h2>
    <ol class={css.explainerList}>
      <li class={shared.learnItem}><span class={shared.learnNum}>1</span><div><b>RSA's lock is a big number.</b> The public key contains N = p × q, two secret prime numbers multiplied together (for example 5 × 13 = 65). Everyone can see N. Only someone who knows p and q can work out the private key. With 600-digit numbers, nobody can find p and q today.</div></li>
      <li class={shared.learnItem}><span class={shared.learnNum}>2</span><div><b>So breaking RSA means finding p and q.</b> That is called factoring. A normal computer has to try numbers one by one, which would take longer than the age of the universe.</div></li>
      <li class={shared.learnItem}><span class={shared.learnNum}>3</span><div><b>Shor's trick: look for a repeating pattern.</b> Pick a number a. Keep multiplying by a and keep only the remainder after dividing by N. The results always loop back to 1. The number of steps in the loop is the period r. A normal computer struggles to find r, but a quantum computer can try every step at once and spot the pattern.</div></li>
      <li class={shared.learnItem}><span class={shared.learnNum}>4</span><div><b>The pattern reveals the factors.</b> Once r is known, a bit of school maths (gcd) turns it into p and q. From p and q you get the private key. That unlocks the secret key, and the secret key opens the message.</div></li>
    </ol>
    <div class={css.example}>
      <b>Tiny example: N = 15, a = 7</b>
      <div class={css.exampleChips}><span>7¹ → 7</span><span>7² → 4</span><span>7³ → 13</span><span>7⁴ → 1 ↺</span></div>
      <p class={css.exampleText}>The loop length is <b>r = 4</b>. Half of it: 7² mod 15 = 4. Then gcd(4 − 1, 15) = <b>3</b> and gcd(4 + 1, 15) = <b>5</b>. So 15 = 3 × 5. Key broken.</p>
    </div>
    <p class={shared.caption}>The simulator does exactly this on a small N. Press <b>Run</b>, then follow the guide to see each step with real numbers.</p>
    <button class={shared.primary} onclick={closeLearn}>Got it, let's start</button>
  </section>
</div>
