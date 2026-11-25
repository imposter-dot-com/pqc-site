// the small helper all the test files share.
// check() prints PASS or FAIL for one test. done() prints the totals at the end and sets the exit code, so npm test stops on a failure.
let pass = 0;
let fail = 0;

export function check(name: string, condition: boolean, extra?: unknown): void {
  if (condition) { pass++; console.log('PASS', name); }
  else { fail++; console.log('FAIL', name, extra ?? ''); }
}

export function done(): never {
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
