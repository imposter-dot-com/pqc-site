// shared Tailwind class strings, for patterns that repeat across pages, components and the HTML strings built in code.
// Tailwind finds these classes because it scans every source file, including this one.
// sizes are written in px (text-[15px]) on purpose: unlike text-sm, they do not change the line height.

// the pieces that several entries below are built from
const surface = 'bg-panel border border-line rounded-card shadow-[0_1px_2px_rgba(16,24,40,.04)] transition-[opacity,filter,box-shadow,border-color] duration-300';
const flatButton = 'border-0 bg-transparent hover:bg-transparent text-muted';
const selectedButton = 'border-0 bg-white hover:bg-white text-accent shadow-[0_1px_3px_rgba(16,24,40,.12)]';
const accentButton = 'bg-accent border-accent text-white hover:bg-accent';
const chart = 'relative bg-white border border-line rounded-lg p-2';
const readsBox = 'rounded-lg px-3.5 py-3 text-[16px] leading-[1.5] [word-break:break-word]';

export const ui = {
  // surfaces
  panel: `${surface} px-6 py-[22px]`,
  sidePanel: `${surface} px-6 py-5`,
  modalPanel: 'bg-panel border border-line rounded-card px-7 py-6',
  flowy: 'flex flex-col gap-[18px] [&>*]:m-0!', // a panel whose children are stacked with an even gap
  panelTitle: 'm-0 mb-3.5 text-[18px] font-[650]',
  caption: 'text-muted text-[15px] leading-[1.65] mt-2.5 mb-0',
  mono: 'font-mono text-[14px]',
  field: 'bg-panel2 border border-line rounded-lg px-2.5 py-2 [word-break:break-word]',
  sideLabel: 'mt-[9px] mb-[3px]', // a label inside the simulator's settings panels
  row: 'flex items-center gap-2.5 [&>*]:flex-1',

  // number tiles ("kv" = key and value)
  kv: 'grid grid-cols-2 gap-3',
  kvCell: 'bg-panel2 rounded-lg px-3 py-[9px]',
  kvLabel: 'block text-[13px] text-muted font-medium',
  kvValue: 'text-[18px] font-[650]',

  // numbered circle
  num: 'inline-flex items-center justify-center size-[22px] rounded-full bg-accent text-white text-[12px] font-bold mr-2.5 align-middle flex-none',

  // buttons (a plain <button> has base styles, these add to it)
  accentBtn: accentButton,
  primary: `${accentButton} w-full p-3 hover:brightness-[1.07]`,
  pill: 'inline-block px-2 py-px rounded-full bg-good text-good-ink text-[13px] whitespace-nowrap',
  closeBtn: 'absolute border-0 bg-transparent hover:bg-transparent text-[24px] px-2.5 py-0.5 text-muted', // the x of a pop-up (add top-* and right-*)

  // segmented switch ("Text message | File") and the tabs: the group, a button, and the selected button
  seg: 'inline-flex gap-1 p-1 bg-panel2 border border-line rounded-[10px]',
  segBtn: `${flatButton} px-3.5 py-[7px]`,
  segOn: `${selectedButton} px-3.5 py-[7px]`,
  tab: `${flatButton} text-[14px] px-3 py-[7px]`,
  tabOn: `${selectedButton} text-[14px] px-3 py-[7px]`,

  // charts and tables
  chartFx: `${chart} h-[300px]`,
  chartHist: `${chart} h-[340px]`,
  tableBox: 'overflow-auto border border-line rounded-lg max-h-[360px]',

  // pop-ups
  overlay: 'fixed inset-0 bg-[rgba(16,24,40,.45)] z-20 items-center justify-center p-6', // add flex or hidden
  learnItem: 'flex items-start gap-3.5 leading-[1.65] text-[16px]',
  learnNum: 'inline-flex items-center justify-center rounded-full bg-accent text-white font-bold flex-none mt-0.5 size-[26px] text-[13px]',

  // what Eve reads, and the result of a decryption
  reads: readsBox,
  readsBad: 'bg-bad border border-bad-line text-bad-ink font-semibold',
  readsOk: 'bg-good border border-good-line text-good-ink',
  resultBox: 'rounded-lg px-3 py-2.5 mt-2.5 font-semibold',
  resultBad: 'bg-bad text-bad-ink',
  resultOk: 'bg-good text-good-ink',

  // the colour of each kind of status box
  status: {
    base: 'rounded-[10px] p-4 text-center font-bold text-[17px] border',
    secure: 'bg-good border-good-line text-good-ink',
    broken: 'bg-bad border-bad-line text-bad-ink',
    held: 'bg-warn border-warn-line text-warn-ink',
    idle: 'bg-panel2 border-line text-muted',
  } as Record<string, string>,
  statusSmall: 'block font-normal mt-1 text-[15px]',
};
