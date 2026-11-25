// Groups Tailwind classes on separate lines, so each line can be read (and commented) on its own.
// It only joins the lines. Prettier sorts the classes inside each line (see .prettierrc.json).
export const tw = (...lines: string[]): string => lines.join(' ');
