// Styles used on more than one page, and by the HTML that the simulator builds in code.
// Sizes are written in px (text-[15px]) on purpose: unlike text-sm, they do not change the line height.
import { tw } from './tw.ts';

// the pieces that several entries below are built from
const surface = tw(
  'rounded-card border border-line bg-panel',
  'shadow-[0_1px_2px_rgba(16,24,40,.04)]',
  'transition-[opacity,filter,box-shadow,border-color] duration-300',
);
const flatButton = tw('border-0 bg-transparent hover:bg-transparent', 'text-muted');
const selectedButton = tw(
  'border-0 bg-white hover:bg-white',
  'text-accent',
  'shadow-[0_1px_3px_rgba(16,24,40,.12)]',
);
const accentButton = tw('border-accent bg-accent hover:bg-accent', 'text-white');
const chart = tw('relative', 'rounded-lg border border-line bg-white p-2');
const readsBox = tw('rounded-lg px-3.5 py-3', 'text-[16px] leading-[1.5] [word-break:break-word]');
const resultBox = tw('mt-2.5 rounded-lg px-3 py-2.5', 'font-semibold');
const panel = tw(surface, 'px-6 py-[22px]');
const flowy = tw('flex flex-col gap-[18px]', '[&>*]:m-0!');
const resultGood = tw('bg-good text-good-ink');
const resultFail = tw('bg-bad text-bad-ink');
const readsGood = tw('border border-good-line bg-good text-good-ink');
const readsBad = tw('border border-bad-line bg-bad font-semibold text-bad-ink');
const caption = tw('mt-2.5 mb-0', 'text-[15px] leading-[1.65] text-muted');
const mono = tw('font-mono text-[14px]');
const field = tw('rounded-lg border border-line bg-panel2 px-2.5 py-2', '[word-break:break-word]');

export const shared = {
  // surfaces
  panel,
  sidePanel: tw(surface, 'px-6 py-5'),
  modalPanel: tw('rounded-card border border-line bg-panel px-7 py-6'),
  flowy, // the children of the panel are stacked with an even gap
  flowPanel: tw(panel, flowy),
  panelTitle: tw('m-0 mb-3.5', 'text-[18px] font-[650]'),
  caption,
  mono,
  field,
  monoField: tw(mono, field),
  sideLabel: tw('mt-[9px] mb-[3px]'), // a label inside the simulator's settings panels
  row: tw('flex items-center gap-2.5', '[&>*]:flex-1'),

  // number tiles ("kv" = key and value)
  kv: tw('grid grid-cols-2 gap-3'),
  kvCell: tw('rounded-lg bg-panel2 px-3 py-[9px]'),
  kvLabel: tw('block', 'text-[13px] font-medium text-muted'),
  kvValue: tw('text-[18px] font-[650]'),

  // numbered circle
  num: tw(
    'inline-flex size-[22px] flex-none items-center justify-center',
    'mr-2.5 align-middle',
    'text-[12px] font-bold text-white',
    'rounded-full bg-accent',
  ),

  // buttons (a plain <button> has base styles, these add to it)
  accentBtn: accentButton,
  primary: tw(accentButton, 'w-full p-3', 'hover:brightness-[1.07]'),
  pill: tw(
    'inline-block whitespace-nowrap',
    'px-2 py-px',
    'text-[13px]',
    'rounded-full bg-good text-good-ink',
  ),
  closeBtn: tw(
    'absolute',
    'px-2.5 py-0.5',
    'text-[24px] text-muted',
    'border-0 bg-transparent hover:bg-transparent',
  ), // the x of a pop-up (add top-* and right-*)

  // segmented switch ("Text message | File") and the tabs: the group, a button, and the selected button
  seg: tw('inline-flex gap-1', 'p-1', 'rounded-[10px] border border-line bg-panel2'),
  segBtn: tw(flatButton, 'px-3.5 py-[7px]'),
  segOn: tw(selectedButton, 'px-3.5 py-[7px]'),
  tab: tw(flatButton, 'px-3 py-[7px] text-[14px]'),
  tabOn: tw(selectedButton, 'px-3 py-[7px] text-[14px]'),

  // charts and tables
  chartFx: tw(chart, 'h-[300px]'),
  chartHist: tw(chart, 'h-[340px]'),
  tableBox: tw('max-h-[360px] overflow-auto', 'rounded-lg border border-line'),

  // pop-ups
  overlay: tw('fixed inset-0 z-20 items-center justify-center p-6', 'bg-[rgba(16,24,40,.45)]'), // add flex or hidden
  learnItem: tw('flex items-start gap-3.5', 'text-[16px] leading-[1.65]'),
  learnNum: tw(
    'inline-flex size-[26px] flex-none items-center justify-center',
    'mt-0.5',
    'text-[13px] font-bold text-white',
    'rounded-full bg-accent',
  ),

  // what Eve reads, and the result of a button click
  reads: readsBox,
  readsBad: tw(readsBox, readsBad),
  readsOk: tw(readsBox, readsGood),
  resultGood: tw(resultBox, resultGood),
  resultFail: tw(resultBox, resultFail),

  // the colour of each kind of status box
  status: {
    base: tw('rounded-[10px] p-4', 'text-center text-[17px] font-bold', 'border'),
    secure: tw('border-good-line bg-good text-good-ink'),
    broken: tw('border-bad-line bg-bad text-bad-ink'),
    held: tw('border-warn-line bg-warn text-warn-ink'),
    idle: tw('border-line bg-panel2 text-muted'),
  } as Record<string, string>,
  statusSmall: tw('mt-1 block', 'text-[15px] font-normal'),
};
