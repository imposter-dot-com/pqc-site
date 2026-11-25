// Styles for Layout.astro. Each line is one group of classes: layout, size and spacing, text, look, states.
import { tw } from './tw.ts';

export const layoutStyles = {
  // the top bar
  nav: tw('flex flex-wrap items-center gap-1', 'px-8 py-3', 'border-b border-line bg-panel'),
  // the site name in the top bar
  brand: tw('mr-[18px]', 'font-bold'),
  // the page content, centred
  wrap: tw('mx-auto max-w-[1500px] px-8 pt-7 pb-16'),
  // the page title
  title: tw('m-0 mb-1', 'text-[28px] font-bold tracking-[-.01em]'),
  // the line under the page title
  subtitle: tw('m-0', 'text-muted'),
  // a link in the top bar
  link: tw('px-3 py-1.5', 'text-[15px] font-medium no-underline', 'rounded-lg'),
  // the link of the current page
  linkOn: tw('text-accent', 'bg-accent-soft'),
  // the other links
  linkOff: tw('text-muted', 'hover:bg-panel2 hover:text-ink'),
};
