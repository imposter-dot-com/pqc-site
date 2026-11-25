// the ui of the shor simulator. it runs shor from shor-core.ts and shows the result on the page.
// the chart drawing is in charts.ts and the circuit drawing is in circuit.ts.
import * as S from '../shor/shor-core.ts';
import type { Attempt, ShorResult, RSAKey } from '../shor/shor-core.ts';
import { COLORS, barChart, binned, clearCanvas } from './charts.ts';
import type { Bar } from './charts.ts';
import { circuitCaption, circuitSvg } from './circuit.ts';
import { ui } from './ui.ts';
import { fullEstimate, hardwareEstimate } from '../noise/hardware-estimate.ts';
import { buildModExp, runFullShot } from '../shor/modexp.ts';
import type { ModExpCircuit } from '../shor/modexp.ts';
import { CHIP_CLASSES, classNoise } from '../noise/ibm-noise.ts';

const $ = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;
const setText = (id: string, text: string): void => { $(id).textContent = text; };

// the sizes the circuit needs for N: n = the bits in N (the target register), t = 2n counting qubits
const sizesFor = (N: number): { n: number; t: number } => { const n = S.bitLength(N); return { n, t: 2 * n }; };
// the base a picked under Advanced settings, or null for Random
const chosenBase = (): number | null => +$<HTMLSelectElement>('aSel').value || null;

// the prime pairs in the dropdown (p, q)
const PRESETS: Array<[number, number]> = [[3, 11], [5, 7], [3, 13], [5, 11], [5, 13], [7, 11], [11, 13], [13, 17], [17, 23]];
const DEFAULT_PRESET = 4; // 5 x 13, so n = 65

// the result of the last run, so the charts can be redrawn
interface Last { res: ShorResult; shown: Attempt | null; N: number; n: number; t: number }

// shots per attempt: how many times the circuit is run and measured with the same base a. the full circuit is slow, so it gets fewer
const SHOTS = 12;
const SHOTS_FULL = 10;

// the full gate-by-gate circuit is only offered up to this N (t = 16 counting qubits, about half a second per shot)
const FULL_MAX_N = 143;

// what the page is showing right now
let rsa: RSAKey | null = null;
// like real systems: the message is locked with a symmetric key (like AES), and RSA only locks that key
let symKey: number[] = [];     // the secret key that locks the message
let lockedKey: number[] = [];  // that key after RSA encryption: this is what Shor attacks
let sealed: number[] = [];     // the message locked with the key
let last: Last | null = null;
let stageIdx = 0; // which tab of the counting register is open

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
    setText('lockedKey', '-');
    rsa = null;
    $<HTMLButtonElement>('go').disabled = true;
    return;
  }

  $<HTMLButtonElement>('go').disabled = false;
  rsa = S.makeRSA(p, q);
  const { n, t } = sizesFor(rsa.N);
  setText('pubkey', `N = ${rsa.N},  e = ${rsa.e}`);
  setText('privkey', 'hidden');
  makeKey();
  encryptMsg();
  fillBases();
  resetResults();
  setText('rcSim', `${3 * n} qubits as drawn (t=${t}, n=${n}); ${t + 4 * n + 3} for the full gate-level build`);
  showHardwareEstimate(t, rsa.N);
  const full = $<HTMLSelectElement>('simMode');
  full.querySelector<HTMLOptionElement>('option[value="full"]')!.disabled = rsa.N > FULL_MAX_N;
  if (rsa.N > FULL_MAX_N) full.value = 'fast';
  showCircuit(t, n, rsa.N, null);
}

const KEY_LENGTH = 8;

// make a new random key and lock it with the public key (RSA only ever locks this key, never the message)
function makeKey(): void {
  if (!rsa) return;
  const top = Math.min(rsa.N, 256) - 1; // each key number has to be smaller than N
  symKey = Array.from({ length: KEY_LENGTH }, () => 1 + Math.floor(Math.random() * top));
  lockedKey = S.rsaEncrypt(symKey, rsa.N, rsa.e);
  setText('lockedKey', lockedKey.join(' '));
}

// lock the message with the key (a toy stand-in for AES: each letter is mixed with a key number)
const mixWithKey = (nums: number[], key: number[]): number[] => nums.map((v, i) => v ^ key[i % key.length]!);

function encryptMsg(): void {
  if (!rsa) return;
  const numbers = S.textToNumbers($<HTMLInputElement>('msg').value);
  sealed = mixWithKey(numbers, symKey);
}

function showCircuit(t: number, n: number, N: number, a: number | null): void {
  $('circuit').innerHTML = circuitSvg(t);
  $('circCap').innerHTML = circuitCaption(t, n, N, a);
}

// ---- the maths of the last run, shown in the guide ----

export interface RunMath { N: number; a: number; r: number; half: number; h: number; g1: number; g2: number; p: number; q: number; phi: number; e: number; d: number; remainderOne: string }

export function runMath(): RunMath | null {
  const shown = last?.shown;
  const factors = last?.res.factors;
  if (!rsa || !shown || !shown.r || !factors || !factors.ok || !shown.factors.ok) return null;

  const { N, a, r } = shown;
  const half = r / 2;
  const h = S.modPow(a, half, N);
  const phi = (factors.p - 1) * (factors.q - 1);
  return {
    N, a, r, half, h,
    g1: S.gcd((h - 1 + N) % N, N),
    g2: S.gcd((h + 1) % N, N),
    p: factors.p,
    q: factors.q,
    phi,
    e: rsa.e,
    d: S.rsaPrivateFromFactors(factors.p, factors.q, rsa.e) as number,
    remainderOne: remainderOneList(phi, rsa.e),
  };
}

// how d is found, written out: the numbers that leave remainder 1 after dividing by phi are 1, 1 + phi, 1 + 2*phi, ...
// d is the first one that e divides, divided by e. (a long list is shortened with ...)
function remainderOneList(phi: number, e: number): string {
  const list: number[] = [];
  for (let v = 1; list.length < 1000; v += phi) { list.push(v); if (v % e === 0) break; }
  const shown = list.length > 8 ? `${list.slice(0, 4).join(', ')}, ..., ${list.slice(-2).join(', ')}` : list.join(', ');
  return shown;
}

// the "base a" dropdown (under Advanced settings): every number that shares no factor with N
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

// show the base a you picked before running: its loop, and whether it can work
function previewA(): void {
  if (!rsa) return;
  resetResults();
  const N = rsa.N;
  const { n, t } = sizesFor(N);
  const a = chosenBase();

  showCircuit(t, n, N, a);
  if (!a) return;

  const r = S.classicalOrder(a, N);
  if (!r) return;
  drawPattern(a, N, r);

  let verdict = 'This a works. Press Run.';
  if (r % 2 === 1) verdict = `r = ${r} is odd, so this a will not work. Pick another.`;
  else if (S.modPow(a, r / 2, N) === N - 1) verdict = 'a<sup>r/2</sup> is −1 mod N, so this a will not work. Pick another.';
  $('fxCap').innerHTML = `With a = ${a}, the answers repeat every <b>r = ${r}</b> steps. ${verdict}`;
}

// ---- running the attack ----

function resetResults(): void {
  last = null;
  $<HTMLTableElement>('shotTbl').tBodies[0]!.innerHTML = '';
  for (const id of ['kA', 'kR', 'kT']) setText(id, '-');
  setText('dec', 'The message is locked with a key, and that key is locked with RSA. Without d, Eve cannot get the key.');
  setStatus('secure', 'Secure', 'No attack run yet.');
  clearCanvas($<HTMLCanvasElement>('fx'));
  clearCanvas($<HTMLCanvasElement>('hist'));
  setText('fxCap', 'Press Run to start.');
  setText('histCap', '');
  renderTabs();
}

function setStatus(kind: string, title: string, small: string): void {
  const el = $('status');
  el.className = `${ui.status.base} ${ui.status[kind]}`;
  el.innerHTML = `${title}<small class="${ui.statusSmall}">${small}</small>`;
}

// one-qubit gates are about 30x better than two-qubit gates on real chips, so they follow the two-qubit slider
function noiseNow(): { readout: number; gate1: number; gate2: number } {
  const value = (id: string): number => +$<HTMLInputElement>(id).value / 100;
  return { readout: value('readout'), gate1: value('gate2') / 30, gate2: value('gate2') };
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

function attack(): void {
  if (!rsa) return;
  const full = $<HTMLSelectElement>('simMode').value === 'full' && rsa.N <= FULL_MAX_N;
  if (!full) { runAttack(false); return; }
  // the full circuit takes a moment, so let the page show a message first
  setStatus('idle', 'Running the full circuit...', 'Every gate of the modular exponentiation is simulated, so this takes a few seconds.');
  setTimeout(() => runAttack(true), 30);
}

function runAttack(full: boolean): void {
  if (!rsa) return;
  const N = rsa.N;
  const { n, t } = sizesFor(N);
  const shots = full ? SHOTS_FULL : SHOTS;
  const noise = noiseNow();

  // Random (the default) picks a base that works, so it always shows the whole idea. a base chosen under Advanced settings gets one try only
  const userA = chosenBase();
  const baseA = userA ?? pickWorkingBase(N);

  // full mode: every gate of the modular exponentiation is run, and each shot can fail anywhere in it
  const circuits = new Map<number, ModExpCircuit>();
  const shot = full
    ? (_an: S.Analysis, a: number, rng: S.Rng, nz: S.NoiseSettings | null) => {
        if (!circuits.has(a)) circuits.set(a, buildModExp(a, N, t));
        return runFullShot(circuits.get(a)!, rng, nz);
      }
    : undefined;

  // run every shot so you can see the whole spread
  const res = S.shor(N, { a: baseA, shots, noise, maxTries: userA ? 1 : full ? 3 : 6, stopEarly: false, shot });

  // the last try that used the quantum circuit is the one we draw
  let shown: Attempt | null = null;
  for (const tr of res.tries) {
    if ('lucky' in tr) continue;
    shown = tr;
  }
  last = { res, shown, N, n, t };

  setText('kA', String(shown ? shown.a : res.tries[res.tries.length - 1]?.a ?? '-'));
  setText('kR', shown && shown.r ? String(shown.r) : '-');
  // how many of the shots gave a valid loop length r (more noise means fewer), and which try it was if the first base failed
  const validShots = shown ? shown.shots.filter(x => x.r).length : 0;
  setText('kT', shown ? `${validShots} / ${shown.shots.length}${res.tries.length > 1 ? ` (try ${res.tries.length})` : ''}` : '-');

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
  const recovered = S.rsaDecrypt(lockedKey, N, d); // Eve unlocks the KEY with d, then uses it on the message
  const plain = S.numbersToText(mixWithKey(sealed, recovered));
  const phi = (p - 1) * (q - 1);
  const first = sealed.length ? S.numbersToText([sealed[0]! ^ recovered[0]!]) : ''; // the first letter, to show the mixing once

  setText('privkey', `d = ${d}`);
  setStatus('broken', 'Key broken', `We factored N = ${N}, unlocked the key, and read the message. Real keys are far bigger.`);
  // the three steps Eve takes, each with its real numbers (all in decimal)
  const nums = (list: number[]): string => `<span class="${ui.mono}">${list.join(' ')}</span>`;
  $('dec').innerHTML =
    `<div class="flex flex-col gap-2.5 leading-[1.5]">` +
    `<div><b>First, Shor factors N:</b> ${N} = ${p} × ${q}. Then φ = (${p} − 1)(${q} − 1) = ${phi}, and d = ${d} because ${rsa.e} × ${d} = ${rsa.e * d} = ${Math.floor((rsa.e * d) / phi)} × ${phi} + 1.</div>` +
    `<div><b>Then d unlocks the key:</b> each number c becomes c<sup>${d}</sup> mod ${N}, for example ${lockedKey[0]}<sup>${d}</sup> mod ${N} = ${recovered[0]}.<br>${nums(lockedKey)}<br>becomes ${nums(recovered)}</div>` +
    `<div><b>Finally, the key unlocks the message:</b>${first ? ` each number is mixed with the key number (XOR), which undoes the scrambling, for example ${sealed[0]} XOR ${recovered[0]} = ${sealed[0]! ^ recovered[0]!}, which is the letter ${first}.` : ''}<br>${nums(sealed)}<br>becomes <b class="text-bad-ink text-[16px]">${plain || '(empty message)'}</b></div>` +
    `</div>`;
}

// shor did not find the factors this time
function showHeld(reason: string, userA: number | null, noise: { readout: number; gate1: number; gate2: number }): void {
  setText('privkey', 'hidden');

  let why = 'Unlucky pick of a. Run again.';
  if (userA) why = `a = ${userA} does not work for this N. Pick another a, or choose Random.`;
  if (noise.readout > 0 || noise.gate2 > 0) why = 'Too much noise, or just unlucky. Try again or lower the noise.';
  setStatus('held', 'RSA held this time', `${why} (${reason})`);
  setText('dec', 'The message is locked with a key, and that key is locked with RSA. Without d, Eve cannot get the key.');
}

// ---- drawing the charts and table ----

const STAGES = ['Superposition', 'Modular exp.', 'After QFT', 'Measured'];
const BLOCKS = 64; // the measured values get grouped into this many blocks

function renderTabs(): void {
  const el = $('tabs');
  el.innerHTML = '';
  STAGES.forEach((name, i) => {
    const button = document.createElement('button');
    button.textContent = name;
    button.className = i === stageIdx ? ui.tabOn : ui.tab;
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
  // the answer we measured on the target register. gate errors in full mode can corrupt it into a value a^x mod N can never give,
  // so we draw the first shot that is a real answer (or the first possible one)
  const measured = (shots.find(s => analysis.classes.has(s.y0)) ?? { y0: analysis.targets[0]!.y }).y0;
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
      `<td class="${ui.mono}">${s.k}</td>` +
      `<td class="${ui.mono}">${s.k}/${Q}</td>` +
      `<td class="${ui.mono}">${s.k === 0 ? '-' : fractions}</td>` +
      `<td class="${ui.mono} ${s.r ? 'text-green' : 'text-muted'}">${s.r || '-'}</td>` +
      `<td class="${ui.mono} ${s.gateErrors ? 'text-bad-ink' : 'text-muted'}">${s.gateErrors}</td>` +
      `<td>${s.r ? `<span class="${ui.pill}">a<sup>r</sup> = 1</span>` : ''}</td>`;
    body.appendChild(row);
  }
}

// ---- noise presets and the real-hardware estimate ----

// readout error as a percentage with one decimal, like 0.9
const readoutPercent = (chance: number): number => Math.round(chance * 1000) / 10;

// the "noise level" dropdown: none, the real readout and gate errors of two ibm chip generations, or your own sliders
function fillNoisePresets(): void {
  const select = $<HTMLSelectElement>('noisePreset');
  select.innerHTML = '<option value="none">No noise (ideal)</option>';
  for (const chip of CHIP_CLASSES) {
    const option = document.createElement('option');
    option.value = chip.id;
    option.textContent = `${chip.label} (readout ${readoutPercent(classNoise(chip).readout).toFixed(1)}%, 2-qubit gate ${(classNoise(chip).twoQubit * 100).toFixed(2)}%)`;
    select.appendChild(option);
  }
  select.innerHTML += '<option value="custom">Custom (use the sliders)</option>';
}

// choosing a preset moves the sliders to that chip's real readout and gate errors
function applyNoisePreset(): void {
  const id = $<HTMLSelectElement>('noisePreset').value;
  if (id === 'custom') return;
  const chip = CHIP_CLASSES.find(c => c.id === id);
  const noise = chip ? classNoise(chip) : { readout: 0, oneQubit: 0, twoQubit: 0 };
  const values: Record<string, number> = {
    readout: readoutPercent(noise.readout),
    gate2: Math.round(noise.twoQubit * 10000) / 100,
  };
  for (const [slider, value] of Object.entries(values)) {
    $<HTMLInputElement>(slider).value = String(value);
    setText(slider + 'V', String(value));
  }
}

// 0.204 -> "20%", 0.0004 -> "0.04%"
const asPercent = (chance: number): string => (chance >= 0.1 ? (chance * 100).toFixed(0) : (chance * 100).toFixed(2)) + '%';

// the table in the pop-up: what real ibm noise would do to the circuit we simulate
const estimateCache = new Map<number, ReturnType<typeof buildModExp>['counts']>();
function showHardwareEstimate(t: number, N: number): void {
  const rows = hardwareEstimate(t);
  if (!estimateCache.has(N)) {
    let a = 2;
    while (S.gcd(a, N) !== 1) a++;
    estimateCache.set(N, buildModExp(a, N, t).counts);
  }
  const counts = estimateCache.get(N)!;
  const whole = fullEstimate(counts, t);
  setText('hwIntro',
    `Real chips make a small error on every gate and every readout [2]. The QFT alone has ${rows[0]!.gates} two-qubit gates. ` +
    `The whole circuit, with the modular exponentiation built from ${counts.total.toLocaleString()} real gates on ${counts.qubits} qubits (our "full circuit" mode), ` +
    `needs about ${whole[0]!.twoQubitGates.toLocaleString()} two-qubit gates (a Toffoli counts as 6 [3]). This is the chance that none of them fails and all ${t} counting bits are read right.`);
  $('hwTbl').innerHTML =
    '<thead><tr><th>Chip</th><th>Two-qubit gate error</th><th>Readout error</th><th>QFT and readout only</th><th>Whole circuit</th></tr></thead><tbody>' +
    rows.map((r, i) =>
      `<tr><td><b>${r.label}</b><br><small>${r.machines}</small></td>` +
      `<td>${(r.twoQubitError * 100).toFixed(2)}%</td><td>${(r.readoutError * 100).toFixed(2)}%</td>` +
      `<td>${asPercent(r.allOk)}</td><td><b>${asPercent(whole[i]!.allOk)}</b></td></tr>`).join('') +
    '</tbody>';
  setText('hwNote',
    'Still generous: real chips also need extra swaps to connect distant qubits, and errors can build up between gates. ' +
    'Our circuit is a simple ripple-carry design [4], so smarter designs use fewer gates, but not by orders of magnitude. ' +
    'This is why today\'s chips cannot run Shor on even toy numbers without error correction. ' +
    'Error rates: median values from IBM calibration snapshots [2].');
}

// ---- hooking everything up ----

export function initSimulator(): void {
  fillPresets();
  fillNoisePresets();

  $<HTMLSelectElement>('preset').onchange = setupKey;
  $<HTMLInputElement>('cp').oninput = setupKey;
  $<HTMLInputElement>('cq').oninput = setupKey;
  $<HTMLInputElement>('msg').oninput = encryptMsg;
  $<HTMLSelectElement>('aSel').onchange = previewA;
  $<HTMLSelectElement>('noisePreset').onchange = applyNoisePreset;
  $<HTMLButtonElement>('go').onclick = attack;

  // moving a noise slider yourself switches the preset to "custom"
  for (const id of ['readout', 'gate2']) $<HTMLInputElement>(id).addEventListener('input', () => { $<HTMLSelectElement>('noisePreset').value = 'custom'; });

  // keep the number next to each slider up to date
  for (const [slider, label] of [['readout', 'readoutV'], ['gate2', 'gate2V']] as const) {
    $<HTMLInputElement>(slider).oninput = () => setText(label, $<HTMLInputElement>(slider).value);
  }

  setupKey();
}
