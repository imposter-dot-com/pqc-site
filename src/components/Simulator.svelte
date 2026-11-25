<script lang="ts">
  import { onMount } from 'svelte';
  import { initSimulator, runMath } from '../lib/ui/simulator.ts';
  import { ui } from '../lib/ui/ui.ts';
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
  const st = (n: number): string => !walk ? '' : !shown(n) ? 'opacity-[.18] blur-[2px] pointer-events-none' : isCurrent(n) ? 'border-accent! shadow-[0_0_0_3px_var(--color-accent-ring)]!' : '';
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

<div class="absolute top-2 right-8 z-[5] flex gap-2 max-[1099px]:static max-[1099px]:mb-4 max-[1099px]:flex-wrap"><button class="px-[13px] py-2 text-[14px]" onclick={() => learn = true}>? How does this break RSA?</button><button class="px-[13px] py-2 text-[14px]" onclick={() => more = true}>Toy vs real hardware</button></div>
<main class="grid grid-cols-[minmax(0,1fr)] gap-7 items-start">
  <!-- the key and the quantum settings -->
  <div class="grid grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] gap-5 items-stretch min-w-0 max-[1100px]:grid-cols-1">
    <div class={ui.sidePanel}>
      <h2 class="m-0 mb-2.5 text-[18px] font-[650]">Pick an RSA key</h2>
      <label class={ui.sideLabel} for="preset">Primes p &times; q</label>
      <select id="preset"></select>
      <div id="customBox" style="display:none">
        <div class={ui.row}><input id="cp" type="number" min="2" value="13" aria-label="prime p"><input id="cq" type="number" min="2" value="29" aria-label="prime q"></div>
        <div class={ui.caption}>Two different primes, N = p&times;q between 27 and 511.</div>
      </div>
      <div class={ui.row}><div><label class={ui.sideLabel}>Public key</label>
      <div class="{ui.mono} {ui.field}" id="pubkey"></div></div>
      <div><label class={ui.sideLabel}>Private key d</label>
      <div class="{ui.mono} {ui.field}" id="privkey">hidden</div></div></div>
      <label class={ui.sideLabel} for="msg">Message or file (letters A-Z)</label>
      <input id="msg" type="text" value="HELLO" maxlength="24">
      <label class={ui.sideLabel}>Key that locks the message (locked with RSA)</label>
      <div class="{ui.mono} {ui.field}" id="lockedKey"></div>
      <div class={ui.caption}>The message is locked with a secret key. RSA only locks that key. Shor breaks the RSA lock, then the key opens the message.</div>
    </div>

    <div class={ui.sidePanel}>
      <div class="flex items-center justify-between gap-3 mb-1.5"><h2 class="m-0 text-[18px] font-[650]">Quantum settings</h2><button class="{ui.accentBtn} inline-flex items-center gap-[7px] hover:brightness-[1.08] rounded-full py-[7px] pr-4 pl-[13px] text-[14px] shadow-[0_2px_6px_rgba(47,91,234,.3)]" id="go" title="Run the attack"><svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M2 1 L11 6 L2 11 Z" fill="currentColor"/></svg>Run</button></div>
      <label class={ui.sideLabel} for="simMode">The a<sup>x</sup> mod N step is</label>
      <select id="simMode"><option value="fast">Computed directly (fast)</option><option value="full">Built from gates (slow, N up to 143)</option></select>
      <div class={ui.caption} id="simModeCap">Built from gates, noise can hit the a<sup>x</sup> mod N step too. Computed directly, only the QFT has gate noise.</div>
      <label class={ui.sideLabel} for="noisePreset">Noise level</label>
      <select id="noisePreset"></select>
      <label class={ui.sideLabel} for="readout">Readout noise: <span id="readoutV">0</span>%</label>
      <input class="my-0.5" id="readout" type="range" min="0" max="20" step="0.1" value="0">
      <label class={ui.sideLabel} for="gate2">Two-qubit gate error: <span id="gate2V">0</span>%</label>
      <input class="my-0.5" id="gate2" type="range" min="0" max="3" step="0.01" value="0">
      <div class={ui.caption}>Readout noise: the chance each measured bit is read wrong. Two-qubit gate error: the chance each two-qubit gate fails.</div>
      <details class="mt-3.5">
        <summary class="font-medium">Advanced settings</summary>
        <label class={ui.sideLabel} for="aSel">Base a (coprime to N)</label>
        <select id="aSel"></select>
        <div class={ui.caption}>Random picks a base that works. Pick your own to see why some bases fail.</div>
      </details>
      
    </div>
  </div>

  <!-- the steps of the break, then the outcome -->
  <div class="flex flex-col gap-6 min-w-0">
  <div class="grid grid-cols-2 gap-6 max-[1100px]:grid-cols-1">
    {#if walk}
      <div class="sticky top-3 z-[4] col-span-full flex items-center justify-between gap-5 bg-accent-soft border border-accent-line rounded-card px-5 py-3.5 shadow-[0_4px_14px_rgba(47,91,234,.15)]">
        <div class="min-w-0 text-[16px] leading-[1.6]">
          <div class="flex items-center gap-3.5 mb-[3px] text-[13px] font-semibold text-accent"><span>Guide · step {step + 1} of {STEPS.length}</span><button class="border-0 bg-transparent hover:bg-transparent p-0 text-accent text-[13px] font-semibold underline" onclick={() => (walk = false)}>Show all</button><small class="text-muted font-normal ml-auto text-[13px]">or use ← →</small></div>
          <b class="text-[17px] mr-1">{@html STEPS[step]!.title}</b> <span>{@html STEPS[step]!.text}</span>
          {#if STEPS[step]!.math?.()}<div class="mt-2 px-3 py-2 bg-white border border-accent-line rounded-lg font-mono text-[14px] leading-[1.7]">{@html STEPS[step]!.math!()}</div>{/if}
        </div>
        <div class="flex gap-2 flex-none"><button class="py-[9px] px-[18px]" onclick={() => goTo(step - 1)} disabled={step === 0}>← Back</button><button class="{ui.accentBtn} py-[9px] px-[18px]" onclick={() => goTo(step + 1)} disabled={step === STEPS.length - 1}>Next →</button></div>
      </div>
    {/if}
    <div class="{ui.panel} col-span-full {st(4)}" data-current={isCurrent(4) ? '' : undefined}>
      <h2 class={ui.panelTitle}><span class={ui.num}>1</span>The quantum circuit</h2>
      <div id="circuit" class="[&_svg]:block [&_svg]:max-h-[340px] [&_svg]:mx-auto"></div>
      <div class={ui.caption} id="circCap"></div>
    </div>
    <div class="{ui.panel} {st(5)}" data-current={isCurrent(5) ? '' : undefined}>
      <h2 class={ui.panelTitle}><span class={ui.num}>2</span>The pattern a<sup>x</sup> mod N repeats</h2>
      <div class={ui.chartFx}><canvas id="fx"></canvas></div>
      <div class={ui.caption} id="fxCap">Press Run to see the period.</div>
    </div>
    <div class="{ui.panel} {st(6)}" data-current={isCurrent(6) ? '' : undefined}>
      <h2 class={ui.panelTitle}><span class={ui.num}>3</span>The counting register</h2>
      <div class="inline-flex flex-wrap gap-1 mb-3.5 p-1 bg-panel2 rounded-[10px]" id="tabs"></div>
      <div class={ui.chartHist}><canvas id="hist"></canvas></div>
      <div class={ui.caption} id="histCap"></div>
    </div>
    <div class="{ui.panel} col-span-full {st(7)}" data-current={isCurrent(7) ? '' : undefined}>
      <h2 class={ui.panelTitle}><span class={ui.num}>4</span>Find the period</h2>
      <div class={ui.tableBox}><table id="shotTbl"><thead><tr><th>#</th><th>k</th><th>k / Q</th><th>fractions</th><th>r (guess)</th><th>gate errors</th><th></th></tr></thead><tbody></tbody></table></div>
      <div class={ui.caption}>k = what we measured, r = our guess for the loop length. A guess is good if a<sup>r</sup> mod N = 1. Gate errors = how many gates failed in that shot (only when gate noise is on). We run 12 shots per attempt (10 when the a<sup>x</sup> mod N step is built from gates, which is slower). One shot only hints at r and can be useless or hit by noise, so we repeat it and keep the best valid r.</div>
    </div>
  </div>

  <div class="grid grid-cols-2 gap-6 max-[1100px]:grid-cols-1">
    <div class="{ui.panel} {st(8)}" data-current={isCurrent(8) ? '' : undefined}>
      <h2 class={ui.panelTitle}><span class={ui.num}>5</span>Outcome</h2>
      <div class="{ui.status.base} {ui.status.secure}" id="status">Secure<small class={ui.statusSmall}>No attack run yet.</small></div>
      <label>How Eve gets the message</label>
      <div class="bg-panel2 rounded-lg p-3 min-h-[70px] text-[14px] [word-break:break-word]" id="dec">The message is locked with a key, and that key is locked with RSA. Without d, Eve cannot get the key.</div>
    </div>
    <div class="{ui.panel} {st(8)}" data-current={isCurrent(8) ? '' : undefined}>
      <h2 class={ui.panelTitle}>Attack summary</h2>
      <div class="grid grid-cols-[repeat(3,1fr)] gap-3">
        <div class={ui.kvCell}><b class={ui.kvLabel}>Base a</b><span class={ui.kvValue} id="kA">-</span></div>
        <div class={ui.kvCell}><b class={ui.kvLabel}>Loop length r</b><span class={ui.kvValue} id="kR">-</span></div>
        <div class={ui.kvCell}><b class={ui.kvLabel}>Valid shots</b><span class={ui.kvValue} id="kT">-</span></div>
      </div>
    </div>
  </div>
  </div>
</main>

<div class="{ui.overlay} {more ? 'flex' : 'hidden'}" onclick={(e) => { if (e.target === e.currentTarget) more = false; }} role="presentation">
<section class="relative bg-bg rounded-2xl p-8 w-[min(1100px,100%)] max-h-full overflow-auto flex flex-col gap-6">
  <button class="{ui.closeBtn} top-3 right-4" onclick={() => more = false} aria-label="Close">&times;</button>
  <div class={ui.modalPanel}>
    <h2 class={ui.panelTitle}>Toy key vs. RSA-2048</h2>
    <div class={ui.kv}>
      <div class={ui.kvCell}><b class={ui.kvLabel}>This simulation</b><span class={ui.kvValue} id="rcSim">-</span></div>
      <div class={ui.kvCell}><b class={ui.kvLabel}>RSA-2048 (estimate)</b><span class={ui.kvValue}>&lt; 1 million noisy qubits</span></div>
    </div>
    <p class="{ui.caption} mt-4!">Gidney (2025) [1] estimates RSA-2048 could be factored with Shor's algorithm [5] using under a million noisy qubits in under a week. Today's devices have only a few thousand, so it isn't possible yet. But data recorded now can be decrypted later ("harvest now, decrypt later"). The QFT's state vector doubles with every counting qubit, so this simulator stops at N = 511 (18 counting qubits).</p>
  </div>
  <div class={ui.modalPanel}>
    <h2 class={ui.panelTitle}>What real IBM hardware noise would do to this circuit</h2>
    <p class="{ui.caption} mt-0! mb-4" id="hwIntro"></p>
    <div class={ui.tableBox}><table id="hwTbl" class="[&_small]:text-muted [&_small]:font-normal [&_td]:align-top [&_th]:align-top"></table></div>
    <p class="{ui.caption} mt-4!" id="hwNote"></p>
  </div>
  <div class={ui.modalPanel}>
    <h2 class={ui.panelTitle}>Sources</h2>
    <ol class="m-0 pl-6 flex flex-col gap-2.5 text-[14px] leading-[1.6] text-muted marker:text-ink">
      <li>C. Gidney, <i>How to factor 2048 bit RSA integers with less than a million noisy qubits</i>, 2025. <a class="text-accent underline underline-offset-2" target="_blank" rel="noopener noreferrer" href="https://arxiv.org/abs/2505.15917">arXiv:2505.15917</a></li>
      <li>IBM error rates: the median readout, one-qubit and two-qubit gate errors from the calibration snapshots of IBM Fez and Marrakesh (Heron r2, 26 Feb 2025) and Sherbrooke, Brisbane and Osaka (Eagle, 2025 and 2024). They ship with the <a class="text-accent underline underline-offset-2" target="_blank" rel="noopener noreferrer" href="https://github.com/Qiskit/qiskit-ibm-runtime">qiskit-ibm-runtime</a> package (Apache 2.0) as <span class="font-mono">fake_provider/backends/*/props_*.json</span>. We average each chip family. See <span class="font-mono">src/lib/noise/ibm-noise.ts</span> to check them.</li>
      <li>M. Nielsen and I. Chuang, <i>Quantum Computation and Quantum Information</i>, Cambridge University Press, 2000. A Toffoli gate takes 6 CNOT gates.</li>
      <li>V. Vedral, A. Barenco and A. Ekert, <i>Quantum networks for elementary arithmetic operations</i>, Physical Review A 54, 147 (1996). <a class="text-accent underline underline-offset-2" target="_blank" rel="noopener noreferrer" href="https://arxiv.org/abs/quant-ph/9511018">arXiv:quant-ph/9511018</a>. This is the adder our full circuit is built from.</li>
      <li>P. Shor, <i>Polynomial-time algorithms for prime factorization and discrete logarithms on a quantum computer</i>, SIAM Journal on Computing 26(5), 1997. <a class="text-accent underline underline-offset-2" target="_blank" rel="noopener noreferrer" href="https://arxiv.org/abs/quant-ph/9508027">arXiv:quant-ph/9508027</a></li>
    </ol>
  </div>
</section>
</div>

<div class="{ui.overlay} {learn ? 'flex' : 'hidden'}" onclick={(e) => { if (e.target === e.currentTarget) closeLearn(); }} role="presentation">
  <section class="relative bg-bg rounded-2xl p-7 w-[min(760px,100%)] max-h-full overflow-auto block">
    <button class="{ui.closeBtn} top-2 right-2.5" onclick={closeLearn} aria-label="Close">&times;</button>
    <h2 class="m-0 mb-4 text-[22px]">How can a quantum computer break RSA?</h2>
    <ol class="list-none m-0 mb-[18px] p-0 flex flex-col gap-3.5">
      <li class={ui.learnItem}><span class={ui.learnNum}>1</span><div><b>RSA's lock is a big number.</b> The public key contains N = p × q, two secret prime numbers multiplied together (for example 5 × 13 = 65). Everyone can see N. Only someone who knows p and q can work out the private key. With 600-digit numbers, nobody can find p and q today.</div></li>
      <li class={ui.learnItem}><span class={ui.learnNum}>2</span><div><b>So breaking RSA means finding p and q.</b> That is called factoring. A normal computer has to try numbers one by one, which would take longer than the age of the universe.</div></li>
      <li class={ui.learnItem}><span class={ui.learnNum}>3</span><div><b>Shor's trick: look for a repeating pattern.</b> Pick a number a. Keep multiplying by a and keep only the remainder after dividing by N. The results always loop back to 1. The number of steps in the loop is the period r. A normal computer struggles to find r, but a quantum computer can try every step at once and spot the pattern.</div></li>
      <li class={ui.learnItem}><span class={ui.learnNum}>4</span><div><b>The pattern reveals the factors.</b> Once r is known, a bit of school maths (gcd) turns it into p and q. From p and q you get the private key. That unlocks the secret key, and the secret key opens the message.</div></li>
    </ol>
    <div class="bg-white border border-line rounded-xl px-[18px] py-3.5 mb-3.5">
      <b>Tiny example: N = 15, a = 7</b>
      <div class="flex flex-wrap gap-2 mt-2 font-mono text-[14px] [&>span]:bg-panel2 [&>span]:rounded-lg [&>span]:px-2.5 [&>span]:py-[5px]"><span>7¹ → 7</span><span>7² → 4</span><span>7³ → 13</span><span>7⁴ → 1 ↺</span></div>
      <p class="mt-2 mb-0 leading-[1.55]">The loop length is <b>r = 4</b>. Half of it: 7² mod 15 = 4. Then gcd(4 − 1, 15) = <b>3</b> and gcd(4 + 1, 15) = <b>5</b>. So 15 = 3 × 5. Key broken.</p>
    </div>
    <p class={ui.caption}>The simulator does exactly this on a small N. Press <b>Run</b>, then follow the guide to see each step with real numbers.</p>
    <button class={ui.primary} onclick={closeLearn}>Got it, let's start</button>
  </section>
</div>
