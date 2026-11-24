// the ui of the shor simulator. it runs shor from shor-core.ts and shows the result on the page.
// the chart drawing is in charts.ts and the circuit drawing is in circuit.ts.
import * as S from './shor-core.ts';
import type { Attempt, ShorResult, RSAKey } from './shor-core.ts';
import { COLORS, barChart, binned, clearCanvas, lineChart } from './charts.ts';
import type { Bar } from './charts.ts';
import { circuitCaption, circuitSvg } from './circuit.ts';

const $ = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;
const setText = (id: string, text: string): void => { $(id).textContent = text; };

// the prime pairs in the dropdown (p, q)
const PRESETS: Array<[number, number]> = [[3, 11], [5, 7], [3, 13], [5, 11], [5, 13], [7, 11], [11, 13], [13, 17], [17, 23]];
const DEFAULT_PRESET = 4; // 5 x 13, so n = 65

// the result of the last run, so the charts can be redrawn
interface Last { res: ShorResult; shown: Attempt | null; N: number; n: number; t: number }
interface SweepData { levels: number[]; rates: number[]; base: number; kind: 'readout' | 'depol'; N: number; a: number }

// what the page is showing right now
let rsa: RSAKey | null = null;
let cipher: number[] = [];
let last: Last | null = null;
let stageIdx = 0; // which tab of the counting register is open
let sweepData: SweepData | null = null;

// turn 12 into ¹² so it prints properly in the log
const SUPERSCRIPT = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const sup = (n: number): string => String(n).split('').map(c => SUPERSCRIPT[+c] ?? c).join('');

// ---- key setup ----

function fillPresets(): void {
  const select = $<HTMLSelectElement>('preset');
  select.innerHTML = '';
  PRESETS.forEach(([p, q], i) => {
    const option = document.createElement('option');
    option.value = String(i);
    option.textContent = `${p} × ${q}  →  N = ${p * q}`;
    select.appendChild(option);
  });
  const custom = document.createElement('option');
  custom.value = 'custom';
  custom.textContent = 'Custom primes...';
  select.appendChild(custom);
  select.value = String(DEFAULT_PRESET);
}

function currentPQ(): number[] {
  const value = $<HTMLSelectElement>('preset').value;
  if (value === 'custom') return [parseInt($<HTMLInputElement>('cp').value, 10), parseInt($<HTMLInputElement>('cq').value, 10)];
  return PRESETS[+value]!;
}

// two different primes whose product is small enough for the simulator
function validPQ(p: number, q: number): boolean {
  const bothPrime = S.isPrime(p) && S.isPrime(q);
  return Number.isInteger(p) && Number.isInteger(q) && p !== q && bothPrime && p * q > 26 && p * q <= 511;
}

function setupKey(): void {
  $('customBox').style.display = $<HTMLSelectElement>('preset').value === 'custom' ? 'block' : 'none';
  const [p, q] = currentPQ() as [number, number];

  if (!validPQ(p, q)) {
    setText('pubkey', 'invalid primes');
    setText('cipher', '-');
    rsa = null;
    $<HTMLButtonElement>('go').disabled = true;
    return;
  }

  $<HTMLButtonElement>('go').disabled = false;
  rsa = S.makeRSA(p, q);
  const n = S.bitLength(rsa.N);
  setText('pubkey', `N = ${rsa.N},  e = ${rsa.e}`);
  setText('privkey', 'hidden');
  encryptMsg();
  fillBases();
  resetResults();
  setText('rcSim', `${3 * n} qubits (t=${2 * n}, n=${n})`);
  showCircuit(2 * n, n, rsa.N, null);
}

// encrypt the message with the public key, one letter at a time
function encryptMsg(): void {
  if (!rsa) return;
  const numbers = S.textToNumbers($<HTMLInputElement>('msg').value);
  cipher = S.rsaEncrypt(numbers, rsa.N, rsa.e);
  setText('cipher', cipher.length ? cipher.join(' ') : '(type some letters)');
}

// the "base a" dropdown: every number that shares no factor with n
function fillBases(): void {
  if (!rsa) return;
  const select = $<HTMLSelectElement>('aSel');
  select.innerHTML = '<option value="0">Random (recommended)</option>';
  for (let a = 2; a < rsa.N; a++) {
    if (S.gcd(a, rsa.N) !== 1) continue;
    const option = document.createElement('option');
    option.value = String(a);
    option.textContent = 'a = ' + a;
    select.appendChild(option);
  }
}

function showCircuit(t: number, n: number, N: number, a: number | null): void {
  $('circuit').innerHTML = circuitSvg(t);
  $('circCap').innerHTML = circuitCaption(t, n, N, a);
}

// ---- the maths of the last run, shown in the guide ----

export interface RunMath { N: number; a: number; r: number; half: number; h: number; g1: number; g2: number; p: number; q: number; phi: number; e: number; d: number }

export function runMath(): RunMath | null {
  const shown = last?.shown;
  const factors = last?.res.factors;
  if (!rsa || !shown || !shown.r || !factors || !factors.ok || !shown.factors.ok) return null;

  const { N, a, r } = shown;
  const half = r / 2;
  const h = S.modPow(a, half, N);
  return {
    N, a, r, half, h,
    g1: S.gcd((h - 1 + N) % N, N),
    g2: S.gcd((h + 1) % N, N),
    p: factors.p,
    q: factors.q,
    phi: (factors.p - 1) * (factors.q - 1),
    e: rsa.e,
    d: S.rsaPrivateFromFactors(factors.p, factors.q, rsa.e) as number,
  };
}

// ---- preview the base a you picked, before running ----

function previewA(): void {
  if (!rsa) return;
  resetResults();
  const N = rsa.N;
  const n = S.bitLength(N);
  const t = 2 * n;
  const a = +$<HTMLSelectElement>('aSel').value;

  showCircuit(t, n, N, a || null);
  if (!a) return;

  const r = S.classicalOrder(a, N);
  if (!r) return;
  drawPattern(a, N, r);

  let verdict = 'This a works. Press Run the attack.';
  if (r % 2 === 1) verdict = `r = ${r} is odd, so this a will not work. Pick another.`;
  else if (S.modPow(a, r / 2, N) === N - 1) verdict = 'a<sup>r/2</sup> is −1 mod N, so this a will not work. Pick another.';
  $('fxCap').innerHTML = `With a = ${a}, the answers repeat every <b>r = ${r}</b> steps. ${verdict}`;
}

// ---- running the attack ----

function resetResults(): void {
  last = null;
  $<HTMLTableElement>('shotTbl').tBodies[0]!.innerHTML = '';
  for (const id of ['kA', 'kR', 'kF', 'kT', 'kQ']) setText(id, '-');
  setText('kN', rsa ? String(rsa.N) : '-');
  setText('dec', 'Ciphertext is unreadable without the private key d.');
  setStatus('secure', 'Secure', 'No attack run yet.');
  clearCanvas($<HTMLCanvasElement>('fx'));
  clearCanvas($<HTMLCanvasElement>('hist'));
  setText('fxCap', 'Press Run the attack to start.');
  setText('histCap', '');
  renderTabs();
  $('log').innerHTML = '';
}

function setStatus(kind: string, title: string, small: string): void {
  const el = $('status');
  el.className = 'status ' + kind;
  el.innerHTML = `${title}<small>${small}</small>`;
}

// add a line to the log. cls colours it: 'c' cyan, 'w' warning, 'b' bad
function log(msg: string, cls?: string): void {
  const el = $('log');
  const line = document.createElement('div');
  if (cls) line.className = cls;
  line.textContent = msg;
  el.appendChild(line);
  el.scrollTop = el.scrollHeight;
}

function noiseNow(): { readout: number; depol: number } {
  return { readout: +$<HTMLInputElement>('readout').value / 100, depol: +$<HTMLInputElement>('depol').value / 100 };
}

// a base a "works" when its loop length r is even and a^(r/2) is not -1 (mod n)
function pickWorkingBase(N: number): number | null {
  const good: number[] = [];
  for (let a = 2; a < N; a++) {
    if (S.gcd(a, N) !== 1) continue;
    const r = S.classicalOrder(a, N);
    if (r && r % 2 === 0 && S.modPow(a, r / 2, N) !== N - 1) good.push(a);
  }
  return good.length ? good[Math.floor(Math.random() * good.length)]! : null;
}

// write what happened in each try to the log
function logTries(res: ShorResult, N: number, t: number): void {
  res.tries.forEach((tr, i) => {
    if ('lucky' in tr) {
      log(`try ${i + 1}: a = ${tr.a} shares factor ${tr.lucky} with N (lucky guess, no quantum step needed)`, 'w');
      return;
    }

    log(`try ${i + 1}: a = ${tr.a}, gcd(a, N) = 1. Run circuit with ${t} counting qubits, ${tr.shots.length} shot(s).`);

    const found = tr.r === null ? 'none' : tr.r;
    const check = tr.r ? `  (a${sup(tr.r)} mod N = ${S.modPow(tr.a, tr.r, N)})` : '';
    log(`   order found: ${found}${check}`, tr.r ? '' : 'w');

    if (!tr.r) {
      log('   no shot gave a valid order. Pick a new a.', 'w');
    } else if (tr.factors.ok) {
      const h = S.modPow(tr.a, tr.r / 2, N);
      log(`   r is even, so take half: h = a${sup(tr.r / 2)} mod N = ${h}. gcd(h − 1, N) and gcd(h + 1, N) give ${tr.factors.p} and ${tr.factors.q}`, 'c');
    } else {
      log(`   r not usable: ${tr.factors.reason}. Pick a new a.`, 'w');
    }
  });
}

function attack(): void {
  if (!rsa) return;
  const N = rsa.N;
  const n = S.bitLength(N);
  const t = 2 * n;
  const shots = +$<HTMLInputElement>('shots').value;
  const noise = noiseNow();

  $('log').innerHTML = '';
  log(`> target public key: N = ${N}, e = ${rsa.e}`, 'c');
  log(`> noise: readout ${(noise.readout * 100).toFixed(1)}%, depolarizing ${(noise.depol * 100).toFixed(0)}%`);

  // "random" picks a base that works, so it always shows the whole idea
  const userA = +$<HTMLSelectElement>('aSel').value || null;
  const baseA = userA ?? pickWorkingBase(N);

  // run every shot so you can see the whole spread. a base you picked yourself gets one try only
  const res = S.shor(N, { a: baseA, shots, noise, maxTries: userA ? 1 : 6, stopEarly: false });
  logTries(res, N, t);

  // the last try that used the quantum circuit is the one we draw
  let shown: Attempt | null = null;
  let shotCount = 0;
  for (const tr of res.tries) {
    if ('lucky' in tr) continue;
    shown = tr;
    shotCount += tr.shots.length;
  }
  last = { res, shown, N, n, t };

  setText('kA', String(shown ? shown.a : res.tries[res.tries.length - 1]?.a ?? '-'));
  setText('kR', shown && shown.r ? String(shown.r) : '-');
  setText('kQ', `${t} + ${n}`);
  setText('kT', `${res.tries.length} / ${shotCount}`);

  const f = res.factors;
  if (f.ok) showBroken(f.p, f.q);
  else showHeld(f.reason, userA, noise);

  renderViews();
}

// shor found the factors: show the private key and read the message
function showBroken(p: number, q: number): void {
  if (!rsa) return;
  const N = rsa.N;
  const d = S.rsaPrivateFromFactors(p, q, rsa.e) as number;
  const plain = S.numbersToText(S.rsaDecrypt(cipher, N, d));

  setText('kF', `${p} × ${q}`);
  setText('privkey', `d = ${d}`);
  log(`> factors: N = ${p} × ${q};  φ = ${(p - 1) * (q - 1)};  d = e⁻¹ mod φ = ${d}`, 'b');
  setStatus('broken', 'Key broken', `We factored N = ${N} and read the message. Real keys are far bigger.`);
  $('dec').innerHTML =
    `ciphertext: ${cipher.join(' ')}<br>decrypted with d = ${d}:<br>` +
    `<b style="color:#d92d4b;font-size:16px">${plain || '(empty message)'}</b>`;
}

// shor did not find the factors this time
function showHeld(reason: string, userA: number | null, noise: { readout: number; depol: number }): void {
  setText('kF', 'not found');
  setText('privkey', 'hidden');
  log(`> attack failed: ${reason}`, 'w');

  let why = 'Unlucky pick of a. Run again.';
  if (userA) why = `a = ${userA} does not work for this N. Pick another a, or choose Random.`;
  if (noise.readout > 0 || noise.depol > 0) why = 'Too much noise, or just unlucky. Try again or lower the noise.';
  setStatus('held', 'RSA held this time', why);
  setText('dec', 'Ciphertext is unreadable without the private key d.');
}

// ---- drawing the charts and table ----

const STAGES = ['1 Superposition', '2 Modular exp.', '3 After QFT', '4 Measured'];
const BLOCKS = 64; // the measured values get grouped into this many blocks

function renderTabs(): void {
  const el = $('tabs');
  el.innerHTML = '';
  STAGES.forEach((name, i) => {
    const button = document.createElement('button');
    button.textContent = name;
    if (i === stageIdx) button.className = 'on';
    button.onclick = () => { stageIdx = i; renderTabs(); renderHist(); };
    el.appendChild(button);
  });
}

function renderViews(): void {
  renderTabs();
  renderPattern();
  renderHist();
  renderTable();
}

function renderPattern(): void {
  if (!last || !last.shown) { clearCanvas($<HTMLCanvasElement>('fx')); return; }
  const { a, N, analysis } = last.shown;
  drawPattern(a, N, analysis.trueOrder as number);
}

// chart 1: the remainders of a^x mod n, step after step
function drawPattern(a: number, N: number, r: number): void {
  const count = Math.max(13, Math.min(2 * r + 1, 40)); // how many steps to draw
  const bars: Bar[] = [];
  let y = 1;
  for (let x = 0; x < count; x++) {
    // each loop gets its own colour, and the bars where the remainder is 1 are green
    const fill = y === 1 ? '#1b8a4b' : COLORS[Math.floor(x / r) % 3]!;
    bars.push({ v: y, fill, label: String(y), tick: String(x), tip: `step ${x}: ${a}^${x} mod ${N} = ${y}` });
    y = (y * a) % N;
  }

  const brackets = [];
  for (let k = 0; k * r < count; k++) {
    const text = k === 0 ? `loop 1 (r = ${r} steps)` : `loop ${k + 1}`;
    brackets.push({ from: k * r, to: Math.min(count - 1, k * r + r - 1), text });
  }

  barChart($<HTMLCanvasElement>('fx'), bars, {
    yMax: N,
    xTitle: `step x (how many times we multiplied by ${a})`,
    yTitle: `remainder (aˣ mod ${N})`,
    yTicks: [[0, '0'], [N, String(N)]],
    brackets,
    keepTinyBars: true, // the remainder 1 is a very short bar, but it matters
  });
  $('fxCap').innerHTML =
    `Each bar is one step x. Its height is the remainder <b>${a}<sup>x</sup> mod ${N}</b>. ` +
    `The <b style="color:#1b8a4b">green bars</b> are where the remainder is 1. After that the same bars repeat, ` +
    `so the loop is <b>${r} steps</b> long. This loop length is called <b>r</b>, and finding it is the whole goal.`;
}

// chart 2: the counting register, one of four stages
function renderHist(): void {
  const canvas = $<HTMLCanvasElement>('hist');
  if (!last || !last.shown) { clearCanvas(canvas); return; }

  const analysis = last.shown.analysis;
  const Q = analysis.Q;
  const r = analysis.trueOrder as number;
  const shots = last.shown.shots;
  const measured = shots[0]!.y0; // the answer we measured on the target register
  const xs = analysis.classes.get(measured) as number[]; // the x values that gave that answer

  // where the spikes should be, as a fraction along the x axis
  const spikes: number[] = [];
  for (let j = 0; j < r; j++) spikes.push(j / r);

  const caption = $('histCap');
  if (stageIdx === 0) showSuperposition(canvas, caption, Q);
  else if (stageIdx === 1) showComb(canvas, caption, Q, r, xs, measured);
  else if (stageIdx === 2) showSpikes(canvas, caption, Q, r, analysis.dist(xs.length, xs), spikes);
  else showMeasured(canvas, caption, Q, shots, spikes);
}

// stage 1: every x is equally likely
function showSuperposition(canvas: HTMLCanvasElement, caption: HTMLElement, Q: number): void {
  const shownCount = Math.min(Q, 24);
  const bars: Bar[] = [];
  for (let x = 0; x < shownCount; x++) bars.push({ v: 1, fill: COLORS[0]!, tick: String(x), tip: `x = ${x}: same chance as every other x` });

  barChart(canvas, bars, {
    yMax: 1,
    xTitle: 'x (the numbers the counting register holds)',
    yTitle: 'chance of each x',
    yTicks: [[0, '0'], [1, 'equal']],
    note: `showing the first ${shownCount} of ${Q}`,
  });
  caption.innerHTML = `Every x from 0 to ${Q - 1} is equally likely, so all the bars are the same height. The quantum computer holds all of them at once.`;
}

// stage 2: after measuring the target, only the x values that gave that answer are left
function showComb(canvas: HTMLCanvasElement, caption: HTMLElement, Q: number, r: number, xs: number[], measured: number): void {
  const kept = new Set(xs);
  const count = Math.min(Q, Math.max(30, Math.min(48, 4 * r)));
  const bars: Bar[] = [];
  for (let x = 0; x < count; x++) {
    const keep = kept.has(x);
    bars.push({ v: keep ? 1 : 0.1, fill: keep ? COLORS[2]! : '#dfe3ea', tick: String(x), tip: `x = ${x}: ${keep ? 'still possible' : 'ruled out'}` });
  }
  const brackets = xs.length > 1 && xs[1]! < count ? [{ from: xs[0]!, to: xs[1]! - 1, text: `${r} apart` }] : [];

  barChart(canvas, bars, {
    yMax: 1,
    xTitle: 'x',
    yTitle: 'still possible?',
    yTicks: [[0.1, 'no'], [1, 'yes']],
    brackets,
    note: `measured answer: ${measured}`,
  });
  caption.innerHTML =
    `We measured the answer <b>${measured}</b>. Only the x values that give that answer stay (<b style="color:#c98a0b">orange</b>). ` +
    `They are evenly spaced, exactly <b>r = ${r}</b> apart.`;
}

// stage 3: the qft turns the even spacing into spikes
function showSpikes(canvas: HTMLCanvasElement, caption: HTMLElement, Q: number, r: number, dist: Float64Array, spikes: number[]): void {
  const blocks = binned(dist, BLOCKS);
  const total = blocks.reduce((sum, v) => sum + v, 0) || 1;
  const top = Math.max(...blocks) / total;
  const bars: Bar[] = Array.from(blocks, (v, i) => ({ v: v / total, fill: COLORS[1]!, tick: tickFor(i, Q), tip: `${blockRange(i, Q)}: ${((v / total) * 100).toFixed(1)}% chance` }));

  barChart(canvas, bars, {
    yMax: top,
    xTitle: `measured value k (grouped in ${BLOCKS} blocks)`,
    yTitle: 'chance of measuring',
    yTicks: [[0, '0%'], [top, (top * 100).toFixed(0) + '%']],
    lines: spikes,
  });
  caption.innerHTML =
    `The QFT turns the even spacing into tall spikes. There are <b>${r}</b> of them, evenly spread (dashed lines). ` +
    'A measurement will land near one. The number of spikes gives away r.';
}

// stage 4: what the measurements actually gave
function showMeasured(canvas: HTMLCanvasElement, caption: HTMLElement, Q: number, shots: Array<{ k: number; r: number | null }>, spikes: number[]): void {
  const counts = new Float64Array(Q);
  for (const shot of shots) counts[shot.k]! += 1;
  const blocks = binned(counts, BLOCKS);
  const top = Math.max(1, ...blocks);
  const bars: Bar[] = Array.from(blocks, (v, i) => ({ v, fill: '#d92d4b', tick: tickFor(i, Q), tip: `${blockRange(i, Q)}: measured ${v} time(s)` }));
  const yTicks: Array<[number, string]> =
    top <= 6 ? Array.from({ length: top + 1 }, (_, i) => [i, String(i)] as [number, string]) : [[0, '0'], [top, String(top)]];

  barChart(canvas, bars, {
    yMax: top,
    xTitle: `measured value k (grouped in ${BLOCKS} blocks)`,
    yTitle: 'times measured',
    yTicks,
    lines: spikes,
  });
  const valid = shots.filter(s => s.r).length;
  caption.innerHTML =
    `We measured ${shots.length} times. Each red bar counts how often the result fell in that block. ${valid} of them gave a valid r. ` +
    'They pile up on the dashed spikes; noise blurs them.';
}

// the range of k values inside a block, for the hover text
function blockRange(block: number, Q: number): string {
  return `k ${Math.round((block * Q) / BLOCKS)} to ${Math.round(((block + 1) * Q) / BLOCKS) - 1}`;
}

// under every 8th block, write the first k value inside it
function tickFor(block: number, Q: number): string {
  return block % 8 === 0 ? String(Math.round((block * Q) / BLOCKS)) : '';
}

// the table of shots: what we measured and what r it gave
function renderTable(): void {
  const body = $<HTMLTableElement>('shotTbl').tBodies[0]!;
  body.innerHTML = '';
  if (!last || !last.shown) return;

  const { Q } = last.shown.analysis;
  for (const s of last.shown.shots) {
    const fractions = s.conv.slice(0, 4).map(c => `${c.num}/${c.den}`).join(', ') + (s.conv.length > 4 ? ', ...' : '');
    const row = document.createElement('tr');
    row.innerHTML =
      `<td>${s.i}</td>` +
      `<td class="mono">${s.k}</td>` +
      `<td class="mono">${s.k}/${Q}</td>` +
      `<td class="mono">${s.k === 0 ? '-' : fractions}</td>` +
      `<td class="mono ${s.r ? 'ok' : 'no'}">${s.r || '-'}</td>` +
      `<td>${s.r ? '<span class="pill">a<sup>r</sup> = 1</span>' : ''}</td>`;
    body.appendChild(row);
  }
}

// ---- noise sweep ----

function runSweep(): void {
  if (!rsa) return;
  const N = rsa.N;
  const kind = $<HTMLSelectElement>('sweepKind').value as 'readout' | 'depol';
  const top = kind === 'readout' ? 0.2 : 1;
  const steps = 10;

  const levels: number[] = [];
  for (let i = 0; i <= steps; i++) levels.push((top * i) / steps);

  // use the base you picked, or the first one that has a usable loop
  let a = +$<HTMLSelectElement>('aSel').value;
  if (!a) {
    a = 2;
    while (S.gcd(a, N) !== 1 || (S.classicalOrder(a, N) ?? 0) < 3) a++;
  }

  $<HTMLButtonElement>('sweep').disabled = true;
  setText('sweepCap', 'Running...');

  // wait a moment so the "running" text shows before the page gets busy
  setTimeout(() => {
    const rates = S.noiseSweep(N, a, levels, kind, 400, Math.random);
    const base = S.noiseSweep(N, a, [1], 'depol', 400, Math.random)[0]!;
    sweepData = { levels, rates, base, kind, N, a };
    drawSweep();
    $<HTMLButtonElement>('sweep').disabled = false;

    const tooSmall = base > 0.4 ? ', so this N is too small to show a clear drop. Try N = 143 or larger.' : '.';
    setText('sweepCap',
      `N = ${N}, a = ${a}, order ${S.classicalOrder(a, N)}. 400 shots per point. ` +
      `Baseline (fully random output) succeeds in ${(base * 100).toFixed(0)}% of shots${tooSmall}`);
  }, 20);
}

function drawSweep(): void {
  if (!sweepData) return;
  const { levels, rates, base, kind } = sweepData;
  const top = levels[levels.length - 1]!;
  lineChart($<HTMLCanvasElement>('sweepC'), {
    labels: levels.map(v => (v * 100).toFixed(top === 1 ? 0 : 1) + '%'),
    rates,
    baseline: base,
    xTitle: kind === 'readout' ? 'readout noise (chance each counting bit flips)' : 'depolarizing noise (chance the whole run is scrambled)',
  });
}

// ---- hooking everything up ----

export function initSimulator(): void {
  fillPresets();

  $<HTMLSelectElement>('preset').onchange = setupKey;
  $<HTMLInputElement>('cp').oninput = setupKey;
  $<HTMLInputElement>('cq').oninput = setupKey;
  $<HTMLInputElement>('msg').oninput = encryptMsg;
  $<HTMLSelectElement>('aSel').onchange = previewA;
  $<HTMLButtonElement>('go').onclick = attack;
  $<HTMLButtonElement>('sweep').onclick = runSweep;

  // keep the number next to each slider up to date
  for (const [slider, label] of [['shots', 'shotsV'], ['readout', 'readoutV'], ['depol', 'depolV']] as const) {
    $<HTMLInputElement>(slider).oninput = () => setText(label, $<HTMLInputElement>(slider).value);
  }

  setupKey();
}
