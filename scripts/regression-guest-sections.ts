// Regression checks for the guest-list section derivation (lib/guestSections.ts).
//
// The repo has no test runner, so this follows the same shape as
// regression-feed-paging.ts: a script you run by hand. It needs no Firebase
// credentials — the module under test is pure, which is most of why it was
// written that way.
//
//   npx tsx scripts/regression-guest-sections.ts
//
// The normalisation cases matter more than the grouping ones. Member documents
// are written by clients across several app versions and firestore.rules
// deliberately does not validate partyRole's value, so this layer is the only
// thing standing between a malformed document and a render crash — Avatar
// splits displayName, and would throw on undefined.

import { toEntry, buildGuestGroups, chunk, GuestMember } from '../lib/guestSections';

let failures = 0;
function check(name: string, ok: boolean, detail = '') {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
}

const member = (uid: string, extra: Partial<GuestMember> = {}): GuestMember => ({
  uid,
  displayName: uid,
  ...extra,
});

console.log('normalising hostile data:');
const junk = toEntry({
  uid: 'x',
  displayName: undefined,
  photoURL: 42,
  howTheyKnow: null,
  isSingle: 'yes',
  partyRole: 'banana',
});
check('absent name becomes "Guest", never undefined', junk.name === 'Guest');
check('non-string photoURL becomes null', junk.photoURL === null);
check('non-string blurb becomes an empty string', junk.blurb === '');
check('non-boolean isSingle becomes false', junk.isSingle === false);
check('unrecognised partyRole falls back to guest', junk.partyRole === 'guest');

console.log('\ngrouping and ordering:');
const entries = [
  member('zoe', { partyRole: 'bridalParty' }),
  member('adam', { partyRole: 'bridalParty' }),
  member('pat', { partyRole: 'couple' }),
  member('sam', { partyRole: 'couple' }),
  member('nan', { partyRole: 'family' }),
  member('rob'), // no partyRole at all — the common case for legacy docs
].map(toEntry);

const groups = buildGuestGroups(entries, '');
check(
  'sections follow the declared order',
  groups.map((g) => g.key).join(',') === 'couple,bridalParty,family,guest'
);
check(
  'members are alphabetical within a section',
  groups[1].items.map((i) => i.uid).join(',') === 'adam,zoe'
);
check(
  'each section maps to its tile scale',
  `${groups[0].variant}/${groups[1].variant}/${groups[3].variant}` === 'large/medium/compact'
);
check('a member with no partyRole lands in the guests section', groups[3].items[0].uid === 'rob');
check('the guests section is never titled "Everyone else"', groups[3].title === 'Guests');

console.log('\nedge cases:');
const legacyOnly = buildGuestGroups([toEntry(member('solo'))], '');
check('empty sections are omitted entirely', legacyOnly.length === 1);
check(
  'a wedding with no party roles reads as "Guests"',
  legacyOnly[0].title === 'Guests',
  'needs no special case now that the section is titled Guests throughout'
);

console.log('\nsearch:');
check('filters by name', buildGuestGroups(entries, 'ada')[0].items[0].uid === 'adam');
check('is case-insensitive', buildGuestGroups(entries, 'ADA').length === 1);
check('a miss yields no sections, so the empty state can fire', buildGuestGroups(entries, 'zzzz').length === 0);
check('whitespace-only search returns everything', buildGuestGroups(entries, '   ').length === 4);

console.log('\nrow chunking:');
check('splits into rows with a partial last row', JSON.stringify(chunk([1, 2, 3, 4, 5], 2)) === '[[1,2],[3,4],[5]]');
check('handles an empty list', chunk([], 3).length === 0);
check('a zero column count does not hang', chunk([1, 2], 0).length === 1);

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
