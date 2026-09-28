// Regression checks for the date/time and invite-code logic
// (lib/weddingConfig.ts, lib/invites.ts) — untested until now, with a
// documented history of bugs (see CLAUDE.md's "Date/Time Handling" section).
//
// Deliberately pure: configFromDoc, the countdown maths in store/
// weddingStore.ts, and joinLink/inviteMessage in lib/invites.ts are all
// plain functions over plain data, so this needs no credentials and no
// device. That is worth more than a live test — everything here runs on
// every commit, not just when someone remembers to run it against real data.
//
// The documented trap: CLAUDE.md says the fallback
// `weddingDateISO + 'T12:00:00Z'` must keep its 'Z', because a bare
// `T12:00:00` parses as LOCAL time and produces off-by-one-day errors in
// timezones behind UTC. A test that only runs in the machine's own timezone
// cannot catch a regression to the bare form unless that machine happens to
// be behind UTC. So this script forces process.env.TZ to a fixed
// behind-UTC zone (Pacific/Honolulu, UTC-10, no DST) before any date
// assertion runs, and includes a canary check that the forcing actually
// took effect — if it silently didn't (a Node/V8 build that caches the
// zone at startup), the canary fails loudly instead of the trap quietly
// going unchecked.
//
// lib/invites.ts does NOT normalise invite codes — it takes whatever string
// it is given and builds a link/message around it. Normalisation
// (trim + uppercase, and — on the save path only — stripping internal
// whitespace) happens inline in app/(onboarding)/invite-codes.tsx,
// app/(auth)/invite.tsx and functions/src/index.ts. This file checks both
// halves: the pure message/link building here, and — by reading those
// three files as source, the same static-check style as
// regression-back-navigation.ts and regression-upload-contract.ts — that
// the client save path, client lookup path and server all agree on the
// normalisation contract a stored code depends on.
//
// A `--live` section (opt-in, off by default) reads real wedding docs
// through the Admin SDK and checks that stored invite codes actually satisfy
// the normalisation invariant the rest of the app assumes — something no
// amount of pure logic can confirm on its own. It requires-in firebase-admin
// lazily, inside the --live branch, specifically so this file has no static
// `from 'firebase-admin'` import: regression-all.ts detects which suites
// need credentials by looking for exactly that import, and this file must
// stay classified as credential-free so its (much larger) set of pure checks
// always run by default.
//
//   npx tsx scripts/regression-wedding-config.ts            # pure checks only
//   npx tsx scripts/regression-wedding-config.ts --live     # also checks real data

import * as fs from 'fs';
import * as path from 'path';

// Set before any Date object is created or inspected below. Verified against
// this repo's Node version to take effect on Date objects created AFTER the
// assignment, which is all of them — this line runs before any import that
// touches a Date.
const FORCED_TZ = 'Pacific/Honolulu'; // UTC-10, no DST: unambiguously "behind UTC"
process.env.TZ = FORCED_TZ;

import { configFromDoc } from '../lib/weddingConfig';
import { joinLink, inviteMessage } from '../lib/invites';
import { useWeddingStore } from '../store/weddingStore';

const RUN_LIVE = process.argv.includes('--live');
const ROOT = process.cwd();

let failures = 0;
function check(name: string, ok: boolean, detail = '') {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
}

function withFixedNow<T>(nowMs: number, fn: () => T): T {
  const real = Date.now;
  Date.now = () => nowMs;
  try {
    return fn();
  } finally {
    Date.now = real;
  }
}

// ---------------------------------------------------------------------------
console.log(`timezone harness (forced TZ=${FORCED_TZ}, actual TZ=${process.env.TZ}):`);

// If this fails, every check below that relies on the forced TZ to detect the
// documented trap is not actually exercising it — it would only be passing
// because the checks happen to also hold in whatever zone the runner is in.
const nearMidnightUTC = '2026-06-15T05:00:00.000Z'; // 05:00 UTC = 19:00 the PREVIOUS day in UTC-10
const probe = new Date(nearMidnightUTC);
check(
  'the forced TZ actually shifts local calendar day off the UTC one',
  probe.getUTCDate() !== probe.getDate(),
  `getUTCDate()=${probe.getUTCDate()} getDate()=${probe.getDate()} under TZ=${process.env.TZ}`
);

// ---------------------------------------------------------------------------
console.log('\nconfigFromDoc: weddingDateTimeUTC (the primary field):');

const cfgUTC = configFromDoc({ weddingDateTimeUTC: nearMidnightUTC });
check('the parsed instant matches the UTC ISO string exactly', cfgUTC.weddingDate.toISOString() === nearMidnightUTC);
check(
  'the UTC calendar day is preserved regardless of the local (behind-UTC) TZ',
  cfgUTC.weddingDate.getUTCDate() === 15 && cfgUTC.weddingDate.getUTCMonth() === 5 && cfgUTC.weddingDate.getUTCFullYear() === 2026
);

// ---------------------------------------------------------------------------
console.log('\nconfigFromDoc: weddingDateISO fallback (weddingDateTimeUTC absent):');

const isoOnly = '2026-06-15';
const correctFallback = new Date(`${isoOnly}T12:00:00Z`); // what configFromDoc actually does
const buggyFallback = new Date(`${isoOnly}T12:00:00`); // the historical bug: no Z, parsed as local

check(
  'the harness can actually tell correct from buggy under the forced TZ',
  correctFallback.getTime() !== buggyFallback.getTime(),
  'otherwise this whole section would pass even with the Z removed'
);

const cfgFallback = configFromDoc({ weddingDateISO: isoOnly });
check('the fallback anchors to noon UTC, not local noon', cfgFallback.weddingDate.toISOString() === '2026-06-15T12:00:00.000Z');
check(
  'the fallback does NOT reproduce the historical bare-time (no "Z") bug',
  cfgFallback.weddingDate.getTime() !== buggyFallback.getTime()
);
check('the fallback preserves the correct UTC calendar day', cfgFallback.weddingDate.getUTCDate() === 15);

// weddingDateTimeUTC takes priority when both are present.
const cfgBoth = configFromDoc({ weddingDateTimeUTC: nearMidnightUTC, weddingDateISO: '2099-01-01' });
check('weddingDateTimeUTC wins over weddingDateISO when both are present', cfgBoth.weddingDate.toISOString() === nearMidnightUTC);

// ---------------------------------------------------------------------------
console.log('\nconfigFromDoc: no date field at all:');

const cfgNeither = configFromDoc({});
check('falls back to a valid (non-NaN) Date rather than throwing or producing Invalid Date', !isNaN(cfgNeither.weddingDate.getTime()));

// ---------------------------------------------------------------------------
console.log('\nconfigFromDoc: other defaults (cheap to check, same function):');

const cfgEmpty = configFromDoc({});
check('monogramInitials falls back to "Y&V"', cfgEmpty.monogramInitials === 'Y&V');
check('accentHex has a sane default rather than being blank', cfgEmpty.accentHex === '#7A4A3F');
check('venueShort falls back to venue when absent', configFromDoc({ venue: 'The Grand Hall' }).venueShort === 'The Grand Hall');
check('registryUrl defaults to null, not undefined (Firestore rejects undefined)', configFromDoc({}).registryUrl === null);
check('coverPhotoURL defaults to null, not undefined', configFromDoc({}).coverPhotoURL === null);

// ---------------------------------------------------------------------------
console.log('\ncountdown maths (store/weddingStore.ts) around the ceremony boundary:');

const T = new Date('2026-06-15T18:30:00.000Z').getTime();
useWeddingStore.getState().setConfig(configFromDoc({ weddingDateTimeUTC: '2026-06-15T18:30:00.000Z' }));

const atMoment = withFixedNow(T, () => useWeddingStore.getState().getCountdownParts());
check(
  'at the exact ceremony moment, the countdown clamps to zero',
  atMoment.days === 0 && atMoment.hours === 0 && atMoment.mins === 0,
  JSON.stringify(atMoment)
);

const oneSecBefore = withFixedNow(T - 1000, () => useWeddingStore.getState().getCountdownParts());
check(
  'one second before the ceremony, every part is non-negative',
  oneSecBefore.days >= 0 && oneSecBefore.hours >= 0 && oneSecBefore.mins >= 0,
  JSON.stringify(oneSecBefore)
);

const oneSecAfter = withFixedNow(T + 1000, () => useWeddingStore.getState().getCountdownParts());
check(
  'one second after the ceremony, the countdown clamps to zero, not negative',
  oneSecAfter.days === 0 && oneSecAfter.hours === 0 && oneSecAfter.mins === 0,
  JSON.stringify(oneSecAfter)
);

const fiveDaysPast = T + 5 * 24 * 60 * 60 * 1000; // "now" is 5 days AFTER the wedding
const wellPast = withFixedNow(fiveDaysPast, () => useWeddingStore.getState().getCountdownParts());
check(
  'a wedding date well in the past clamps to zero, never negative',
  wellPast.days === 0 && wellPast.hours === 0 && wellPast.mins === 0,
  JSON.stringify(wellPast)
);
check(
  'getDaysUntilWedding also clamps a past wedding to zero, never negative',
  withFixedNow(fiveDaysPast, () => useWeddingStore.getState().getDaysUntilWedding()) === 0
);

// Away from any boundary, so the days/hours/mins decomposition itself — not
// just the clamp — is checked: 1 day, 2 hours, 3 minutes, 30 seconds before.
const decompNow = T - (1 * 86400000 + 2 * 3600000 + 3 * 60000 + 30000);
const decomp = withFixedNow(decompNow, () => useWeddingStore.getState().getCountdownParts());
check(
  'countdown decomposes into days/hours/mins correctly away from a boundary',
  decomp.days === 1 && decomp.hours === 2 && decomp.mins === 3,
  JSON.stringify(decomp)
);

// ---------------------------------------------------------------------------
console.log('\nlib/invites.ts: joinLink does not normalise — it passes the code through:');

const messyCode = '  g-4b2x 9f1k  ';
const link = joinLink(messyCode);
check('the link is built on the JOIN_URL host', link.startsWith('https://vowedsocial.com/join?code='));
check(
  'the code is percent-encoded, not normalised — casing/whitespace are the caller\'s job',
  link === `https://vowedsocial.com/join?code=${encodeURIComponent(messyCode)}`,
  link
);
check('a clean code round-trips unchanged through encodeURIComponent', joinLink('VOWED-GUEST').endsWith('code=VOWED-GUEST'));

// ---------------------------------------------------------------------------
console.log('\nlib/invites.ts: inviteMessage — guest vs host, with/without a couple name:');

const guestNamed = inviteMessage('guest', 'VOWED-GUEST', 'James & Olivia');
check('guest message includes the couple name when given', guestNamed.includes('James & Olivia'));
check('guest message includes the join link', guestNamed.includes(joinLink('VOWED-GUEST')));
check('guest message includes the raw code as a fallback entry method', guestNamed.includes('Or enter the code: VOWED-GUEST'));
check('guest message never mentions host access', !/host access/i.test(guestNamed));

const guestAnon = inviteMessage('guest', 'VOWED-GUEST');
check('guest message falls back to generic phrasing with no couple name', guestAnon.includes('Join our wedding on Vowed'));

const guestBlankName = inviteMessage('guest', 'VOWED-GUEST', '   ');
check(
  'a whitespace-only couple name is treated the same as no name at all',
  guestBlankName === guestAnon,
  'coupleName?.trim() must make an all-whitespace name falsy, not print a blank'
);

const hostNamed = inviteMessage('host', 'VOWED-HOST', 'James & Olivia');
check('host message includes the couple name when given', hostNamed.includes('James & Olivia'));
check('host message explicitly names host access', /host access/i.test(hostNamed));
check('host message warns against forwarding', /forward/i.test(hostNamed));
check('host message includes the join link', hostNamed.includes(joinLink('VOWED-HOST')));

const hostAnon = inviteMessage('host', 'VOWED-HOST');
check('host message falls back to generic phrasing with no couple name', hostAnon.includes('host access to a wedding'));

check('guest and host messages for the same code are never identical', guestNamed !== hostNamed);

// ---------------------------------------------------------------------------
console.log('\ninvite-code normalisation: static source cross-check (client save, client lookup, server):');

const readSrc = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const inviteCodesSrc = readSrc('app/(onboarding)/invite-codes.tsx');
const inviteScreenSrc = readSrc('app/(auth)/invite.tsx');
const functionsSrc = readSrc('functions/src/index.ts');

// Save path (host sets the codes during onboarding): trim + uppercase + strip
// internal whitespace, so whatever ends up in weddingsByCode/{code} is
// already clean and exactly what a normalised lookup will produce.
const saveNormalisations = [...inviteCodesSrc.matchAll(/\.trim\(\)\.toUpperCase\(\)\.replace\(\/\\s\/g,\s*''\)/g)];
check(
  'invite-codes.tsx normalises BOTH guest and host codes the same way before saving',
  saveNormalisations.length === 2,
  `found ${saveNormalisations.length} occurrence(s) of trim().toUpperCase().replace(/\\s/g, '')`
);
check('invite-codes.tsx rejects codes shorter than 4 characters after normalising', /\.length < 4/.test(inviteCodesSrc));
check('invite-codes.tsx rejects an identical guest and host code', /g === h/.test(inviteCodesSrc));

// Lookup path (anyone joining): trim + uppercase, matching the server. It
// does NOT strip internal whitespace — and it doesn't need to, since every
// code that can ever be stored already had internal whitespace stripped at
// save time by invite-codes.tsx above. A saved code can never contain a
// space for this lookup to fail to match.
const lookupNormalisations = [...inviteScreenSrc.matchAll(/\.trim\(\)\.toUpperCase\(\)/g)];
check(
  'invite.tsx normalises the code with trim().toUpperCase() before every server call',
  lookupNormalisations.length >= 3,
  `found ${lookupNormalisations.length} occurrence(s); expected at least validateInviteCode, claimHostRole, setPendingCode`
);
check(
  'invite.tsx does not double-strip internal whitespace out of user input',
  !/\.trim\(\)\.toUpperCase\(\)\.replace\(\/\\s\/g/.test(inviteScreenSrc),
  'stripping whitespace here would silently accept a code that was never actually stored, which is worse than rejecting it'
);

// Server contract: functions/src/index.ts must agree with the client's
// lookup normalisation exactly, since it is the actual source of truth.
const serverCodeNormalisations = [...functionsSrc.matchAll(/\(request\.data\?\.code as string \| undefined\)\?\.trim\(\)\.toUpperCase\(\)/g)];
check(
  'validateInviteCode and claimHostRole both normalise the incoming code with trim().toUpperCase()',
  serverCodeNormalisations.length >= 2,
  `found ${serverCodeNormalisations.length} occurrence(s) in functions/src/index.ts`
);

// generateCode()'s alphabet: uppercase already (so client normalisation is a
// no-op on a freshly generated code, not a correction), and excludes 0/O and
// 1/I so a guest reading a code off a screen or a printed invite never has to
// guess which character they are looking at.
const alphabetMatch = inviteCodesSrc.match(/const chars = '([^']+)'/);
check('generateCode\'s alphabet is findable in source', !!alphabetMatch);
if (alphabetMatch) {
  const alphabet = alphabetMatch[1];
  check('the alphabet contains no lowercase letters', alphabet === alphabet.toUpperCase());
  check('the alphabet excludes 0 and O', !alphabet.includes('0') && !alphabet.includes('O'));
  check('the alphabet excludes 1 and I', !alphabet.includes('1') && !alphabet.includes('I'));
}

// ---------------------------------------------------------------------------
async function runLiveChecks() {
  if (!RUN_LIVE) {
    console.log('\nlive checks: skipped (pass --live to check real stored invite codes and dates)');
    return;
  }

  console.log('\nlive checks (real data, Admin SDK, read-only):');
  const keyPath = path.join(ROOT, 'serviceAccountKey.json');
  if (!fs.existsSync(keyPath)) {
    console.log(`  SKIPPED — serviceAccountKey.json not found in ${ROOT}`);
    return;
  }

  // Required-in lazily and only here: a top-level `import ... from
  // 'firebase-admin'` would make regression-all.ts classify this whole file
  // as needing credentials and skip it by default, hiding every pure check
  // above. See the file header.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const admin = require('firebase-admin');
  if (admin.apps.length === 0) {
    admin.initializeApp({ credential: admin.credential.cert(keyPath) });
  }
  const db = admin.firestore();

  const weddings = await db.collection('weddings').get();
  let checkedDates = 0;
  let checkedCodes = 0;

  for (const w of weddings.docs) {
    const data = w.data();
    const label = data.coupleName ?? w.id;

    const parsed = configFromDoc(data);
    checkedDates++;
    check(`${label}: weddingDate parses to a valid, non-NaN Date`, !isNaN(parsed.weddingDate.getTime()));

    for (const field of ['guestInviteCode', 'hostInviteCode'] as const) {
      const code: unknown = data[field];
      if (typeof code !== 'string' || code.length === 0) continue;
      checkedCodes++;
      check(`${label}: ${field} is already uppercase in Firestore`, code === code.toUpperCase(), code);
      check(`${label}: ${field} has no internal or surrounding whitespace`, /^\S+$/.test(code), JSON.stringify(code));
    }

    if (typeof data.guestInviteCode === 'string' && typeof data.hostInviteCode === 'string') {
      check(`${label}: guest and host codes differ`, data.guestInviteCode !== data.hostInviteCode);
    }

    for (const [field, role] of [
      ['guestInviteCode', 'guest'],
      ['hostInviteCode', 'host'],
    ] as const) {
      const code: unknown = data[field];
      if (typeof code !== 'string' || code.length === 0) continue;
      const indexDoc = await db.collection('weddingsByCode').doc(code).get();
      check(`${label}: weddingsByCode/${code} exists`, indexDoc.exists);
      if (indexDoc.exists) {
        const idx = indexDoc.data();
        check(`${label}: weddingsByCode/${code} points back at this wedding`, idx?.weddingId === w.id);
        check(`${label}: weddingsByCode/${code} has role "${role}"`, idx?.role === role);
      }
    }
  }

  console.log(`  (checked ${checkedDates} wedding date(s), ${checkedCodes} invite code(s))`);
}

runLiveChecks()
  .catch((e) => {
    console.error(e);
    failures++;
  })
  .finally(() => {
    console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
    process.exit(failures === 0 ? 0 : 1);
  });
