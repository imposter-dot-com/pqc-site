// Styles for index.astro. Each line is one group of classes: layout, size and spacing, text, look, states.
import { tw } from './tw.ts';

export const homeStyles = {
  // the heading block
  hero: tw('mx-auto max-w-[760px] pt-10 pb-9', 'text-center'),
  // the small pill above the title
  eyebrow: tw(
    'inline-block',
    'mb-4 px-3 py-[5px]',
    'text-[13px] font-semibold text-accent',
    'rounded-full bg-accent-soft',
  ),
  // the main title
  title: tw('m-0 mb-3', 'text-[length:clamp(28px,4vw,42px)] leading-[1.12] tracking-[-.02em]'),
  // the sentence under the title
  intro: tw('m-0', 'text-[17px] text-muted'),
  // the three page cards
  cards: tw('grid grid-cols-3 gap-6', 'max-[900px]:grid-cols-1'),
  // one page card (a link)
  card: tw(
    'group flex flex-col',
    'px-[22px] pt-5 pb-[22px]',
    'text-ink no-underline',
    'rounded-card border border-line bg-panel shadow-[0_1px_2px_rgba(16,24,40,.04)] transition-[border-color,box-shadow] duration-150',
    'hover:border-accent hover:shadow-[0_4px_14px_rgba(47,91,234,.12)]',
  ),
  // the grey box around a card picture
  art: tw('mb-[18px] p-2.5', 'rounded-[10px] bg-panel2'),
  // a card picture
  artSvg: tw('block', 'h-auto w-full'),
  // the title row of a card
  cardHead: tw('flex items-center', 'mb-1.5'),
  // a card title
  cardTitle: tw('m-0', 'text-[18px]'),
  // a card description
  cardText: tw('flex-1', 'm-0', 'text-[15px] text-muted'),
  // the "Open ..." link of a card
  cardLink: tw('mt-3.5', 'text-[15px] font-semibold text-accent', 'group-hover:underline'),
  // the line at the bottom
  footnote: tw('mt-7 mb-0', 'text-center text-[14px] text-muted'),
};
