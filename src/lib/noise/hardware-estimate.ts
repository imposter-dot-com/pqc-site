// a rough estimate of what real ibm hardware noise would do to the circuit we simulate.
//
// hardwareEstimate counts only the qft and the readout. fullEstimate also counts the modular exponentiation, using the gates
// of the circuit we really build in modexp.ts. real chips need extra swaps to connect distant qubits, which neither counts,
// so the true chance of a clean run is lower still.
// both assume every error is independent, and that nothing is done to correct or reduce errors.
import * as S from '../shor/shor-core.ts';
import { CHIP_CLASSES, classNoise } from './ibm-noise.ts';
import type { GateCounts } from '../shor/modexp.ts';

// the two-qubit gates the qft needs on real hardware (a controlled-phase gate takes 2, a swap takes 3)
export const qftTwoQubitGates = (t: number): number => S.qftGates(t).reduce((total, gate) => total + S.twoQubitCost(gate), 0);

// the chance that none of `count` steps goes wrong, when each one goes wrong with chance `p`
export const chanceNoError = (p: number, count: number): number => Math.pow(1 - p, count);

export interface HardwareEstimate {
  label: string;
  machines: string;
  twoQubitError: number;
  readoutError: number;
  gates: number;        // two-qubit gates in the qft
  gatesOk: number;      // the chance none of them goes wrong
  readoutOk: number;    // the chance all t counting bits are read correctly
  allOk: number;        // both at once
}

// t is the number of counting qubits
export function hardwareEstimate(t: number): HardwareEstimate[] {
  return estimateFor(qftTwoQubitGates(t), t);
}

// the chance of a clean run for a circuit with this many two-qubit gates and this many bits to read
function estimateFor(gates: number, bits: number): HardwareEstimate[] {
  const t = bits;
  return CHIP_CLASSES.map(chip => {
    const noise = classNoise(chip);
    const gatesOk = chanceNoError(noise.twoQubit, gates);
    const readoutOk = chanceNoError(noise.readout, t);
    return {
      label: chip.label,
      machines: chip.machines.map(m => m.machine).join(', '),
      twoQubitError: noise.twoQubit,
      readoutError: noise.readout,
      gates,
      gatesOk,
      readoutOk,
      allOk: gatesOk * readoutOk,
    };
  });
}

export interface FullEstimate {
  label: string;
  qubits: number;
  oneQubitGates: number;   // hadamards and X gates
  twoQubitGates: number;   // cnots, toffolis (6 each) and the qft's two-qubit gates
  allOk: number;           // the chance that no gate fails and every counting bit is read right
}

// the chance that the whole circuit, modular exponentiation included, runs with no error at all
export function fullEstimate(counts: GateCounts, t: number): FullEstimate[] {
  const qft = qftTwoQubitGates(t);
  const oneQubitGates = counts.hadamards + counts.oneQubit;
  const twoQubitGates = counts.twoQubitEquivalent + qft;
  return CHIP_CLASSES.map(chip => {
    const noise = classNoise(chip);
    const allOk = chanceNoError(noise.oneQubit, oneQubitGates) * chanceNoError(noise.twoQubit, twoQubitGates) * chanceNoError(noise.readout, t);
    return { label: chip.label, qubits: counts.qubits, oneQubitGates, twoQubitGates, allOk };
  });
}
