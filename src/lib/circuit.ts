// draws the shor circuit as an svg string, in the style of qiskit (ibm colours):
// purple h gates, blue controlled-u gates, a teal qft box, grey measurements, and a double line for the classical bits

const W = 720;
const H = 262;
const TARGET_Y = 196;   // the target wire
const CLASSICAL_Y = 240;
const WIRE_START = 70;
const WIRE_END = W - 24;
const COUNTING_Y = [44, 84, 150]; // we only draw 3 of the counting wires: q0, q1 and the last one

const STYLE =
  '<style>' +
  'text{font:15px "Helvetica Neue",Helvetica,Arial,sans-serif;fill:#1c2230}' +
  '.lab{fill:#4a5468;font-size:14px}' +
  '.w{stroke:#8d96a6;stroke-width:1.4}' +
  '.gt{font-weight:600;fill:#fff;text-anchor:middle}' +
  '.st{fill:#4a5468;font-size:14px;text-anchor:middle}' +
  '</style>';

// a letter with a small number next to it, like q0
const subscript = (letter: string, small: string): string => `${letter}<tspan dy="4" font-size="10">${small}</tspan>`;

function wire(x1: number, y: number, x2: number): string {
  return `<line class="w" x1="${x1}" y1="${y}" x2="${x2}" y2="${y}"/>`;
}

// t = number of counting qubits
export function circuitSvg(t: number): string {
  let s = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Shor order-finding circuit">${STYLE}`;

  // headings for the four stages
  const stages: Array<[number, string]> = [
    [110, '1 Superposition'],
    [285, '2 a<tspan dy="-6" font-size="11">x</tspan><tspan dy="6"> mod N</tspan>'],
    [455, '3 QFT'],
    [590, '4 Measure'],
  ];
  for (const [x, label] of stages) s += `<text class="st" x="${x}" y="16">${label}</text>`;

  // dashed lines between the stages
  for (const x of [190, 385, 525]) {
    s += `<line x1="${x}" y1="24" x2="${x}" y2="${TARGET_Y + 22}" stroke="#d5d9e1" stroke-dasharray="4 4"/>`;
  }

  // the counting qubit wires and their labels
  const names = ['0', '1', String(t - 1)];
  COUNTING_Y.forEach((y, i) => {
    s += `<text x="8" y="${y + 4}">${subscript('q', names[i]!)}</text>${wire(WIRE_START - 14, y, WIRE_END)}`;
  });
  s += '<text x="26" y="118" class="lab">⋮</text>'; // the wires we left out

  // the target wire, which starts in the state |1>
  s += `<text x="8" y="${TARGET_Y + 4}">target</text>${wire(WIRE_START + 8, TARGET_Y, WIRE_END)}`;
  s += `<text class="lab" x="${WIRE_START + 10}" y="${TARGET_Y - 8}">|1⟩</text>`;

  // the classical bits (a double line)
  s += `<text x="8" y="${CLASSICAL_Y + 4}">c</text>`;
  s += wire(WIRE_START - 14, CLASSICAL_Y - 2, WIRE_END) + wire(WIRE_START - 14, CLASSICAL_Y + 2, WIRE_END);
  s += `<text class="lab" x="${WIRE_START - 8}" y="${CLASSICAL_Y - 8}">${t}</text>`;

  // h gates
  for (const y of COUNTING_Y) {
    s += `<rect x="100" y="${y - 16}" width="32" height="32" rx="4" fill="#6929c4"/><text class="gt" x="116" y="${y + 5}">H</text>`;
  }

  // controlled-u gates (blue): a dot on each counting wire, a line down to the box on the target wire
  const gateX = [215, 262, 312];
  const gateLabels = [
    'U',
    'U<tspan dy="-7" font-size="11">2</tspan>',
    'U<tspan dy="-7" font-size="11">2</tspan><tspan dy="-5" font-size="9">t−1</tspan>',
  ];
  COUNTING_Y.forEach((y, i) => {
    const x = gateX[i]! + 16;
    s += `<line x1="${x}" y1="${y}" x2="${x}" y2="${TARGET_Y - 16}" stroke="#002d9c" stroke-width="1.6"/>`;
    s += `<circle cx="${x}" cy="${y}" r="5" fill="#002d9c"/>`;
  });
  gateX.forEach((x, i) => {
    const width = i === 2 ? 64 : 32;
    s += `<rect x="${x}" y="${TARGET_Y - 16}" width="${width}" height="32" rx="4" fill="#002d9c"/>`;
    s += `<text class="gt" x="${x + width / 2}" y="${TARGET_Y + 5}">${gateLabels[i]}</text>`;
  });
  s += `<text class="lab" x="${gateX[0]}" y="${TARGET_Y + 34}">U|y⟩ = |a·y mod N⟩</text>`;

  // the qft box
  s += '<rect x="410" y="26" width="92" height="144" rx="4" fill="#005d5d"/><text class="gt" x="456" y="102">QFT</text>';

  // measurement boxes (grey with a little meter) and a dashed line down to the classical bits
  for (const y of COUNTING_Y) {
    s += `<rect x="560" y="${y - 16}" width="36" height="32" rx="4" fill="#697077"/>`;
    s += `<path d="M567 ${y + 8} a11 11 0 0 1 22 0" stroke="#fff" fill="none" stroke-width="1.5"/>`;
    s += `<line x1="578" y1="${y + 8}" x2="585" y2="${y - 5}" stroke="#fff" stroke-width="1.5"/>`;
    s += `<line x1="578" y1="${y + 16}" x2="578" y2="${CLASSICAL_Y - 2}" stroke="#8d96a6" stroke-width="1.2" stroke-dasharray="3 3"/>`;
  }

  return s + '</svg>';
}

// the explanation under the circuit
export function circuitCaption(t: number, n: number, N: number, a: number | null): string {
  return (
    'Read it left to right: try every x at once, compute a<sup>x</sup> mod N, use the QFT to spot the pattern, then measure. ' +
    `Only some wires are drawn: there are ${t} counting qubits (q<sub>0</sub> to q<sub>${t - 1}</sub>, they hold x) ` +
    `plus ${n} target qubits (they hold a<sup>x</sup> mod N), ${t + n} in total.` +
    (a ? ` Here N = ${N} and a = ${a}.` : '')
  );
}
