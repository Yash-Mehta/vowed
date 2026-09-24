// Wiring checks for the root <Stack /> (app/_layout.tsx) and the routes pushed
// onto it.
//
// The hook itself cannot be exercised headlessly — useCallback needs a React
// dispatcher and useRouter a mounted navigator. But useGoBack is three lines
// and has never been the bug. The bugs are structural, and visible in the
// source: a route added to the stack whose back button calls router.back()
// directly (which no-ops on a cold start and reads as a frozen screen), a
// fallback pointing at a route that was since renamed, or the root reverting
// to <Slot />, which unmounts the tab group and sends every back button to the
// feed.
//
//   npx tsx scripts/regression-back-navigation.ts
//
// Needs no credentials and no device.

import * as fs from 'fs';
import * as path from 'path';

const APP = path.join(process.cwd(), 'app');

let failures = 0;
function check(name: string, ok: boolean, detail = '') {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
}

const routeFile = (route: string) =>
  [path.join(APP, `${route}.tsx`), path.join(APP, route, 'index.tsx')].find((p) => fs.existsSync(p));

const layoutRaw = fs.readFileSync(path.join(APP, '_layout.tsx'), 'utf8');
// Strip comments before any structural test. The comments in _layout.tsx
// explain the Slot-to-Stack change and therefore contain the literal "<Slot />",
// which a naive search reads as the thing it is warning about.
const layout = layoutRaw
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '')
  .replace(/^[ \t]*\/\/.*$/gm, '');

console.log('root navigator:');
check('the root renders a <Stack>, not a <Slot>', /<Stack\b/.test(layout) && !/<Slot\b/.test(layout));
check('the root stack hides headers, so no route gets a second one',
  /screenOptions=\{\{[^}]*headerShown:\s*false/.test(layout));
check("the root stack's default animation is none",
  /screenOptions=\{\{[^}]*animation:\s*'none'/.test(layout),
  "so the guard's redirects still look the way they did under Slot");
check('the back gesture is off by default',
  /screenOptions=\{\{[^}]*gestureEnabled:\s*false/.test(layout),
  'otherwise every root screen — tabs, select-wedding, auth — is edge-swipe-poppable on iOS');

console.log('\nthe guard never leaves a screen underneath:');
// router.replace() swaps only the top entry. Left alone, the signed-out landing
// screen survives beneath the tabs and a swipe reaches it.
const guard = layout.slice(layout.indexOf('const resetTo'));
check('a resetTo helper exists', /const resetTo\s*=/.test(layout));
check('resetTo tears the stack down before replacing',
  /canDismiss\(\)\s*\)?\s*&&?\s*router\.dismissAll\(\)|canDismiss\(\)\)\s*router\.dismissAll\(\)/.test(layout));
const bareReplaces = [...guard.matchAll(/router\.replace\(/g)].length;
check('no guard redirect calls router.replace directly', bareReplaces <= 1,
  `${bareReplaces} call(s); exactly one belongs, inside resetTo itself`);

const declared = [...layout.matchAll(/<Stack\.Screen\s+name="([^"]+)"/g)].map((m) => m[1]);
console.log(`\ndeclared pushed routes (${declared.length}): ${declared.join(', ')}`);

for (const route of declared) {
  const file = routeFile(route);
  check(`${route} resolves to a real route file`, !!file);
  if (!file) continue;
  const src = fs.readFileSync(file, 'utf8');
  const escaped = route.replace(/[[\]]/g, '\\$&');
  check(`${route} animates, so a push is visibly a push`,
    new RegExp(`name="${escaped}"[\\s\\S]{0,160}?animation:\\s*'slide_from_(right|bottom)'`).test(layout));
  check(`${route} uses useGoBack`, /useGoBack\(/.test(src),
    'router.back() alone no-ops on a cold start onto this route');
  check(`${route} does not also call router.back() directly`, !/router\.back\(/.test(src));
  const fallback = src.match(/useGoBack\(\s*'([^']+)'/)?.[1];
  check(`${route} names a fallback screen`, !!fallback, fallback ?? 'none found');
  if (fallback) {
    check(`${route}'s fallback ${fallback} is a real route`,
      !!routeFile(fallback.replace(/^\//, '')), `looked for app${fallback}.tsx`);
  }
}

console.log('\ncompose keeps the gesture off, so a draft cannot be swiped away:');
check('compose does not opt into gestureEnabled',
  !/name="compose"[\s\S]{0,160}?gestureEnabled:\s*true/.test(layout),
  'a stray swipe would discard a caption and up to ten attached photos');

console.log('\nno route uses useGoBack without being declared on the stack:');
const walk = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)]
  );
for (const f of walk(APP).filter((f) => f.endsWith('.tsx') && /useGoBack\(/.test(fs.readFileSync(f, 'utf8')))) {
  const route = path.relative(APP, f).replace(/\.tsx$/, '').replace(/\/index$/, '');
  check(`${route} is declared as a <Stack.Screen>`, declared.includes(route),
    'otherwise it silently takes the default animation and gesture');
}

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
