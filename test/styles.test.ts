// run with: node test/styles.test.ts
// every style name used in the markup (css.something, shared.something) must exist in the style files.
// the type checker does not look inside Svelte and Astro templates, so a wrong name would silently give an element no styling.
import { readFileSync } from 'node:fs';
import { check, done } from './check.ts';
import { shared } from '../src/styles/shared.ts';
import { layoutStyles } from '../src/styles/layout.ts';
import { homeStyles } from '../src/styles/home.ts';
import { simulatorStyles } from '../src/styles/simulator.ts';
import { attackStyles } from '../src/styles/attack.ts';
import { vizStyles } from '../src/styles/attack-viz.ts';
import { encryptStyles } from '../src/styles/encrypt.ts';

// each file, and which style object its "css" refers to
const files: Array<[string, Record<string, unknown>]> = [
  ['src/layouts/Layout.astro', layoutStyles],
  ['src/pages/index.astro', homeStyles],
  ['src/components/Simulator.svelte', simulatorStyles],
  ['src/lib/ui/simulator.ts', simulatorStyles],
  ['src/components/Attack.svelte', attackStyles],
  ['src/components/AttackViz.svelte', vizStyles],
  ['src/components/Encrypt.svelte', encryptStyles],
];

const pathExists = (object: unknown, path: string[]): boolean =>
  path.every((key) => {
    if (object === null || typeof object !== 'object' || !(key in object)) return false;
    object = (object as Record<string, unknown>)[key];
    return true;
  });

// css.a, css.a.b, shared.a, shared.a.b
const used = (source: string, name: string): string[][] =>
  [...source.matchAll(new RegExp(`\\b${name}\\.(?!ts\\b)([A-Za-z]+)(?:\\.([A-Za-z]+))?`, 'g'))].map((m) => [m[1]!, m[2]].filter(Boolean) as string[]);

for (const [file, css] of files) {
  const source = readFileSync(file, 'utf8');
  const bad: string[] = [];
  for (const path of used(source, 'css')) if (!pathExists(css, path)) bad.push('css.' + path.join('.'));
  for (const path of used(source, 'shared')) if (!pathExists(shared, path)) bad.push('shared.' + path.join('.'));
  check(`${file}: every style name exists`, bad.length === 0, [...new Set(bad)]);
}

// every style is a non-empty string (an entry that lost its classes would style nothing)
const empty = (object: Record<string, unknown>, prefix = ''): string[] =>
  Object.entries(object).flatMap(([key, value]) =>
    typeof value === 'string' ? (value.trim() ? [] : [prefix + key]) : empty(value as Record<string, unknown>, prefix + key + '.'));
for (const [name, styles] of Object.entries({ shared, layoutStyles, homeStyles, simulatorStyles, attackStyles, vizStyles, encryptStyles }))
  check(`${name}: no empty style`, empty(styles).length === 0, empty(styles));

done();
