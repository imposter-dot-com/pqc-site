// Styles for Attack.svelte. Each line is one group of classes: layout, size and spacing, text, look, states.
import { tw } from './tw.ts';
import { shared } from './shared.ts';

export const attackStyles = {
  // the whole page
  page: tw('flex flex-col gap-5'),
  // the list of steps
  flow: tw('flex flex-col gap-3.5'),
  // the right side of a step card
  stepBody: tw('flex-1', 'min-w-0'),
  // the one-line description of a step
  stepText: tw('mt-1 mb-0', 'text-[15px] text-muted'),
  // what a finished step shows
  stepOutput: tw('flex flex-col gap-3', 'mt-3.5', 'leading-[1.6]'),
  // the "What Eve reads" label
  outputLabel: tw('block', 'mb-[5px]', 'text-[13px] font-medium text-muted'),
  // the two boxes in the conclusion
  summary: tw('grid grid-cols-2 gap-5', 'mt-1.5', 'max-[900px]:grid-cols-1'),
  // the title of an act
  actTitle: tw('m-0', 'text-[21px]'),
  // extra space above the first act
  actFirst: tw('mt-1.5'),
  // extra space above the later acts
  actLater: tw('mt-[18px]'),
  // one step card
  stepCard: tw('flex items-start gap-4', 'px-[22px] py-[18px]', 'rounded-xl border bg-panel'),
  // the step you are on
  stepCurrent: tw('border-accent shadow-[0_0_0_3px_var(--color-accent-ring)]'),
  // the other steps
  stepIdle: tw('border-line shadow-[0_1px_2px_rgba(16,24,40,.04)]'),
  // a step that has not happened yet
  stepTodo: tw('opacity-45'),
  // the number (or tick) of a step
  stepNumber: tw(
    'inline-flex flex-none items-center justify-center align-middle',
    'mt-0.5 mr-2.5 size-[26px]',
    'text-[13px] font-bold text-white',
    'rounded-full',
  ),
  // a finished step
  stepNumberDone: tw('bg-green'),
  // a step that is not finished
  stepNumberOpen: tw('bg-accent'),
  // the key and message panel, with Start over
  setup: tw(
    shared.panel,
    'grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-5',
    'max-[900px]:grid-cols-1 [&_label]:mt-0',
  ),
  // the button of the step you are on
  nextButton: tw(shared.accentBtn, 'mt-3.5 px-7 py-[11px]', 'hover:brightness-[1.07]'),
};
