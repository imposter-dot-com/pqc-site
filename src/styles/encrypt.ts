// Styles for Encrypt.svelte. Each line is one group of classes: layout, size and spacing, text, look, states.
import { tw } from './tw.ts';
import { shared } from './shared.ts';

export const encryptStyles = {
  // the two columns
  page: tw('grid grid-cols-2 items-start gap-6', 'max-[900px]:grid-cols-1'),
  // one column
  column: tw('flex flex-col gap-2', 'min-w-0'),
  // a grid of two number tiles
  tiles: tw('grid grid-cols-2 gap-3.5'),
  // a small heading inside a panel
  subheading: tw('text-[15px] font-semibold text-ink'),
  // a box of hex bytes
  hexBox: tw('p-2.5', 'font-mono text-[14px] break-all', 'rounded-lg bg-panel2'),
  // the "what happened" cards
  stepGrid: tw('grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3.5'),
  // one "what happened" card
  stepCard: tw('px-4 py-3.5', 'rounded-lg bg-panel2'),
  // the name in a step card
  stepName: tw('block', 'text-[15px] leading-[1.35]'),
  // the time and size in a step card
  stepDetail: tw('block', 'mt-1', 'text-[14px] text-muted'),
  // the file header box
  headerBox: tw('flex flex-col gap-3.5', 'px-[18px] py-4', 'rounded-[10px] bg-panel2'),
  // the label of one header field
  headerLabel: tw('block', 'mb-[3px]', 'text-[14px] text-muted'),
  // the decrypted picture
  previewImage: tw('self-start', 'max-h-[260px] max-w-full', 'rounded-lg border border-line'),
  // the decrypted text or bytes
  previewText: tw(
    'overflow-auto',
    'max-h-[220px] p-2.5',
    'font-mono text-[14px] break-all whitespace-pre-wrap',
    'rounded-lg bg-panel2',
  ),
  // the value of one header field (add a colour)
  headerValue: tw('block', 'font-mono text-[14px] leading-[1.5] break-all'),
  // two number tiles with some space above
  facts: tw(shared.kv, 'mt-3.5'),
};
