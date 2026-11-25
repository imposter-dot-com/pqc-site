// Styles for AttackViz.svelte. Each line is one group of classes: layout, size and spacing, text, look, states.
import { tw } from './tw.ts';

export const vizStyles = {
  // one row of the lock and unlock diagrams
  lockRow: tw('flex flex-wrap items-center gap-3'),
  // the "and the same for..." row
  lockMore: tw('flex flex-wrap items-center gap-3', 'pl-1', 'text-[14px] text-muted'),
  // Alice to Bob
  transferRow: tw('flex flex-wrap items-center justify-center gap-3'),
  // the dashed wire the packets travel on
  wire: tw('flex flex-wrap gap-2', 'px-2.5 py-2', 'border-x-0 border-y-2 border-dashed border-wire'),
  // one packet on the wire
  packet: tw('px-[9px] py-1', 'text-[13px]', 'rounded-md border border-line bg-panel2'),
  // the arrow down to Eve
  eveColumn: tw('flex flex-col flex-wrap items-center justify-center gap-0.5'),
  // the label on that arrow
  eveLabel: tw('mt-0.5', 'text-center text-[12px] text-muted'),
  // two boxes stacked
  stack: tw('flex flex-col gap-2'),
  // one of the two loop charts
  spectrumCard: tw('px-4 py-3.5', 'rounded-[10px] border border-line bg-white'),
  // the title row of a loop chart
  spectrumHead: tw('flex flex-wrap items-baseline justify-between gap-3', 'mb-2'),
  // the drawing of a loop chart
  spectrumChart: tw('block', 'h-[84px] w-full', 'rounded-md bg-panel2'),
  // the axis under a loop chart
  spectrumAxis: tw('flex justify-between', 'mt-1.5', 'text-[13px] text-muted'),
  // a box in a diagram (add a kind, and a minimum width)
  box: tw(
    'max-w-[260px] px-3 py-2',
    'text-center text-[15px] font-semibold [word-break:break-word]',
    'rounded-[10px] border',
  ),
  // the small title inside a box
  label: tw('block', 'mb-0.5', 'text-[12px] font-medium text-muted'),
  // numbers inside a box
  mono: tw('font-mono text-[13px] font-medium'),
  // a diagram laid out in a row
  row: tw('flex flex-wrap items-center gap-2.5', 'px-[18px] py-4', 'rounded-xl border border-line bg-sunken'),
  // a diagram laid out in a column
  column: tw(
    'flex flex-col flex-wrap items-stretch gap-2.5',
    'px-[18px] py-4',
    'rounded-xl border border-line bg-sunken',
  ),
  // an arrow between two boxes
  arrow: tw('inline-flex flex-col items-center', 'text-[18px] leading-[1.1] text-muted'),
  // the arrow symbol
  arrowIcon: tw('text-[22px] not-italic'),
  // the words under an arrow
  arrowLabel: tw('mt-0.5 max-w-[130px]', 'text-center text-[12px] text-muted'),
  // the sentence under a diagram
  note: tw('mt-1 mb-0', 'text-[15px] leading-[1.55] text-muted'),
  // the "found a loop" score
  score: tw('px-2.5 py-0.5', 'text-[14px] font-semibold', 'rounded-full'),
  // a score that found loops
  scoreBad: tw('text-bad-ink', 'bg-bad'),
  // a score that found none
  scoreGood: tw('text-good-ink', 'bg-good'),
  // the colours of a box, by what it holds
  kind: {
    plain: tw('border-line bg-white'),
    key: tw('border-warn-line bg-warn'),
    lock: tw('border-accent-line bg-accent-soft text-lock-ink'),
    data: tw('border-line bg-panel2'),
    tag: tw('border-violet-line bg-violet-soft'),
    bad: tw('border-bad-line bg-bad text-bad-ink'),
    ok: tw('border-good-line bg-good text-good-ink'),
  },
};
