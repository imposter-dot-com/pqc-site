// Styles for Simulator.svelte. Each line is one group of classes: layout, size and spacing, text, look, states.
import { tw } from './tw.ts';
import { shared } from './shared.ts';

export const simulatorStyles = {
  // the two buttons at the top right
  topButtons: tw(
    'absolute top-2 right-8 z-[5] flex gap-2',
    'max-[1099px]:static max-[1099px]:mb-4 max-[1099px]:flex-wrap',
  ),
  // one of them
  topButton: tw('px-[13px] py-2', 'text-[14px]'),
  // the whole page
  page: tw('grid grid-cols-[minmax(0,1fr)] items-start gap-7'),
  // the key and settings panels
  controls: tw(
    'grid grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] items-stretch gap-5',
    'min-w-0',
    'max-[1100px]:grid-cols-1',
  ),
  // the title of the key panel
  keyTitle: tw('m-0 mb-2.5', 'text-[18px] font-[650]'),
  // the title row of the settings panel
  settingsHead: tw('flex items-center justify-between gap-3', 'mb-1.5'),
  // the title of the settings panel
  settingsTitle: tw('m-0', 'text-[18px] font-[650]'),
  // everything under the controls
  content: tw('flex flex-col gap-6', 'min-w-0'),
  // the 2 x 2 grid of panels
  quad: tw('grid grid-cols-2 gap-6', 'max-[1100px]:grid-cols-1'),
  // the guide bar
  guideBar: tw(
    'sticky top-3 z-[4] col-span-full flex items-center justify-between gap-5',
    'px-5 py-3.5',
    'rounded-card border border-accent-line bg-accent-soft shadow-[0_4px_14px_rgba(47,91,234,.15)]',
  ),
  // the text side of the guide bar
  guideInfo: tw('min-w-0', 'text-[16px] leading-[1.6]'),
  // the first line of the guide bar
  guideHead: tw('flex items-center gap-3.5', 'mb-[3px]', 'text-[13px] font-semibold text-accent'),
  // the "Show all" link
  guideLink: tw(
    'p-0',
    'text-[13px] font-semibold text-accent underline',
    'border-0 bg-transparent',
    'hover:bg-transparent',
  ),
  // "or use the arrow keys"
  guideHint: tw('ml-auto', 'text-[13px] font-normal text-muted'),
  // the title of the current step
  guideTitle: tw('mr-1', 'text-[17px]'),
  // the numbers of the current step
  guideMath: tw(
    'mt-2 px-3 py-2',
    'font-mono text-[14px] leading-[1.7]',
    'rounded-lg border border-accent-line bg-white',
  ),
  // the Back and Next buttons
  guideButtons: tw('flex flex-none gap-2'),
  // the Back button
  guideButton: tw('px-[18px] py-[9px]'),
  // the circuit drawing
  circuitSvg: tw('[&_svg]:mx-auto [&_svg]:block [&_svg]:max-h-[340px]'),
  // the tabs of the counting register
  tabs: tw('inline-flex flex-wrap gap-1', 'mb-3.5 p-1', 'rounded-[10px] bg-panel2'),
  // how Eve gets the message
  message: tw('min-h-[70px] p-3', 'text-[14px] [word-break:break-word]', 'rounded-lg bg-panel2'),
  // the three summary tiles
  summaryTiles: tw('grid grid-cols-[repeat(3,1fr)] gap-3'),
  // a pop-up window
  popup: tw(
    'relative flex flex-col gap-6 overflow-auto',
    'max-h-full w-[min(1100px,100%)] p-8',
    'rounded-2xl bg-bg',
  ),
  // the table of real chips
  hardwareTable: tw('[&_small]:font-normal [&_small]:text-muted [&_td]:align-top [&_th]:align-top'),
  // the list of sources
  sources: tw('flex flex-col gap-2.5', 'm-0 pl-6', 'text-[14px] leading-[1.6] text-muted', 'marker:text-ink'),
  // a link in the sources
  sourceLink: tw('text-accent underline underline-offset-2'),
  // the "How does this break RSA?" window
  explainerPopup: tw(
    'relative block overflow-auto',
    'max-h-full w-[min(760px,100%)] p-7',
    'rounded-2xl bg-bg',
  ),
  // its title
  explainerTitle: tw('m-0 mb-4', 'text-[22px]'),
  // its list of four ideas
  explainerList: tw('flex list-none flex-col gap-3.5', 'm-0 mb-[18px] p-0'),
  // its worked example
  example: tw('mb-3.5 px-[18px] py-3.5', 'rounded-xl border border-line bg-white'),
  // the chips in the example
  exampleChips: tw(
    'flex flex-wrap gap-2',
    'mt-2',
    'font-mono text-[14px]',
    '[&>span]:rounded-lg [&>span]:bg-panel2 [&>span]:px-2.5 [&>span]:py-[5px]',
  ),
  // the sentence in the example
  exampleText: tw('mt-2 mb-0', 'leading-[1.55]'),
  // a panel the guide has not reached yet
  guidePending: tw('pointer-events-none opacity-[.18] blur-[2px]'),
  // the panel the guide is on
  guideCurrent: tw('border-accent! shadow-[0_0_0_3px_var(--color-accent-ring)]!'),
  // the three steps Eve takes
  outcomeSteps: tw('flex flex-col gap-2.5', 'leading-[1.5]'),
  // the recovered message
  recoveredText: tw('text-[16px] text-bad-ink'),
  // the Run button
  runButton: tw(
    shared.accentBtn,
    'inline-flex items-center gap-[7px]',
    'py-[7px] pr-4 pl-[13px] text-[14px]',
    'rounded-full shadow-[0_2px_6px_rgba(47,91,234,.3)] hover:brightness-[1.08]',
  ),
  guideNext: tw(shared.accentBtn, 'px-[18px] py-[9px]'),
  widePanel: tw(shared.panel, 'col-span-full'),
  closeRight: tw(shared.closeBtn, 'top-3 right-4'),
  closeLearn: tw(shared.closeBtn, 'top-2 right-2.5'),
  popupCaption: tw(shared.caption, 'mt-4!'),
  popupIntro: tw(shared.caption, 'mt-0! mb-4'),
};
