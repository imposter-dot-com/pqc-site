// real noise numbers from ibm quantum computers.
//
// where they come from: the official `qiskit-ibm-runtime` package (apache 2.0) ships snapshots of the
// calibration data of real ibm machines, in `fake_provider/backends/<machine>/props_<machine>.json`.
// this is the same data qiskit aer uses to copy a real machine's noise.
// for each machine we took the median over all qubits (readout, one-qubit gate) or over all working
// couplers (two-qubit gate). couplers marked with a 100% error are broken, so they were left out.
//
// to check the numbers yourself:
//   pip download qiskit-ibm-runtime --no-deps      (then unzip the .whl file and open the json files)
//
// errors are chances between 0 and 1, so 0.0198 means 1.98%.

export interface MachineNoise {
  machine: string;
  snapshot: string;     // the date of the calibration snapshot
  readout: number;      // the chance a measured bit comes out wrong
  oneQubit: number;     // the chance a one-qubit gate (sx) goes wrong
  twoQubit: number;     // the chance a two-qubit gate (ecr or cz) goes wrong
}

export interface ChipClass {
  id: 'eagle' | 'heron';
  label: string;
  chip: string;         // a short description of the chip generation
  machines: MachineNoise[];
}

export const CHIP_CLASSES: ChipClass[] = [
  {
    id: 'heron',
    label: 'IBM Heron r2',
    chip: '156 qubits, cz gates',
    machines: [
      { machine: 'Fez', snapshot: '2025-02-26', readout: 0.0076, oneQubit: 0.00023, twoQubit: 0.0038 },
      { machine: 'Marrakesh', snapshot: '2025-02-26', readout: 0.0095, oneQubit: 0.00023, twoQubit: 0.0032 },
    ],
  },
  {
    id: 'eagle',
    label: 'IBM Eagle',
    chip: '127 qubits, ecr gates',
    machines: [
      { machine: 'Sherbrooke', snapshot: '2025-02-26', readout: 0.0198, oneQubit: 0.00024, twoQubit: 0.0075 },
      { machine: 'Brisbane', snapshot: '2025-02-26', readout: 0.0200, oneQubit: 0.00024, twoQubit: 0.0077 },
      { machine: 'Osaka', snapshot: '2024-02-28', readout: 0.0211, oneQubit: 0.00023, twoQubit: 0.0066 },
    ],
  },
];

const average = (machines: MachineNoise[], key: 'readout' | 'oneQubit' | 'twoQubit'): number =>
  machines.reduce((sum, m) => sum + m[key], 0) / machines.length;

// one number per chip generation: the average of its machines
export function classNoise(c: ChipClass): { readout: number; oneQubit: number; twoQubit: number } {
  return { readout: average(c.machines, 'readout'), oneQubit: average(c.machines, 'oneQubit'), twoQubit: average(c.machines, 'twoQubit') };
}
