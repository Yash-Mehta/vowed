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

import { toEntry, buildGuestGroups, chunk, COLUMNS_BY_VARIANT, GuestMember } from '../lib/guestSections';
import { PARTY_ROLE_ORDER, PARTY_ROLE_LABELS, PARTY_ROLE_SECTION_TITLES, toPartyRole } from '../lib/partyRoles';

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

console.log('\npartyRole normalisation against hostile values:');
// Client-written, and firestore.rules constrains the field's presence but never
// its value. The prototype-ish keys matter because VALID is a Set (no prototype
// chain) but the label Record it guards is an ordinary object literal.
const HOSTILE: ReadonlyArray<readonly [string, unknown]> = [
  ['__proto__', '__proto__'],
  ['constructor', 'constructor'],
  ['toString', 'toString'],
  ['a number', 0],
  ['NaN', NaN],
  ['null', null],
  ['undefined', undefined],
  ['an object', {}],
  ['an array', ['couple']],
  ['a capitalised role', 'Couple'],
  ['a padded role', ' couple'],
];
for (const [label, value] of HOSTILE) {
  const role = toPartyRole(value);
  check(`${label} normalises to guest`, role === 'guest');
  check(`${label} still yields a renderable label`, typeof PARTY_ROLE_LABELS[role] === 'string');
}

console.log('\nthe label maps themselves:');
// This is why every read must go through toPartyRole. The Record is a plain
// object literal, so a bare index reaches Object.prototype — labels['toString']
// is a function, and guest/[uid].tsx calls .toUpperCase() on what it gets back.
const bareLabels = PARTY_ROLE_LABELS as unknown as Record<string, unknown>;
check(
  'indexing the label map directly DOES reach Object.prototype',
  typeof bareLabels['toString'] === 'function',
  'which is why no read may use a bare cast'
);
check(
  'every role toPartyRole can return has an OWN label',
  PARTY_ROLE_ORDER.every((r) => Object.prototype.hasOwnProperty.call(PARTY_ROLE_LABELS, r))
);
check(
  'every role toPartyRole can return has an OWN section title',
  PARTY_ROLE_ORDER.every((r) => Object.prototype.hasOwnProperty.call(PARTY_ROLE_SECTION_TITLES, r))
);
check('no label is empty, so a badge cannot render as a blank pill',
  PARTY_ROLE_ORDER.every((r) => PARTY_ROLE_LABELS[r].trim().length > 0));
check('PARTY_ROLE_ORDER has no duplicates, so nobody is listed twice',
  new Set(PARTY_ROLE_ORDER).size === PARTY_ROLE_ORDER.length);

console.log('\nnames that render as nothing:');
// trim() strips U+00A0 and U+FEFF but NOT U+200B and the other format
// characters, so a name made only of those used to survive as "visually empty".
const ZWSP = String.fromCharCode(0x200b);
const NBSP = String.fromCharCode(0x00a0);
const RLO = String.fromCharCode(0x202e);
check('a whitespace-only name falls back to Guest', toEntry(member('a', { displayName: '   ' })).name === 'Guest');
check('a non-breaking-space name falls back to Guest', toEntry(member('a', { displayName: NBSP })).name === 'Guest');
check('a zero-width-space name falls back to Guest', toEntry(member('a', { displayName: ZWSP })).name === 'Guest');
check('a right-to-left-override name falls back to Guest', toEntry(member('a', { displayName: RLO })).name === 'Guest');
check('a real name is never mangled by the stripping', toEntry(member('a', { displayName: '  Ada Lovelace ' })).name === 'Ada Lovelace');
check('an emoji-only name survives', toEntry(member('a', { displayName: '\u{1F389}' })).name === '\u{1F389}');

console.log('\nrole normalisation (authorization, not display):');
check('role host is preserved', toEntry(member('a', { role: 'host' })).role === 'host');
check('an absent role reads as guest', toEntry(member('a')).role === 'guest');
check('a malformed role never reads as elevated', toEntry(member('a', { role: 'HOST' })).role === 'guest');
check('an object role never reads as elevated', toEntry(member('a', { role: {} })).role === 'guest');

console.log('\ngrouping invariants:');
const MIXED = [
  member('u1', { displayName: 'Ada', partyRole: 'couple' }),
  member('u2', { displayName: 'ada', partyRole: 'couple' }),
  member('u0', { displayName: 'Ada', partyRole: 'couple' }),
  member('u3', { displayName: 'Zoe', partyRole: 'bridalParty' }),
  member('u4', { displayName: null, partyRole: 'family' }),
  member('u5', { displayName: '   ' }),
  member('u6', { displayName: 'Bob', partyRole: '__proto__' }),
].map(toEntry);
const mixedGroups = buildGuestGroups(MIXED, '');
const flatItems = mixedGroups.flatMap((g) => g.items);
check('grouping is lossless — every member lands in exactly one section',
  flatItems.length === MIXED.length, `${MIXED.length} in, ${flatItems.length} out`);
check('grouping never duplicates a member',
  new Set(flatItems.map((e) => e.uid)).size === flatItems.length);
// The original alphabetical check used distinct names, so byName's uid branch
// never ran. Three people all sorting to "ada" is what forces it.
check('equal searchKeys fall back to the uid tiebreaker',
  mixedGroups[0].items.map((i) => i.uid).join(',') === 'u0,u1,u2');
check('order does not depend on the order the snapshot arrived in',
  JSON.stringify(buildGuestGroups([...MIXED].reverse(), '').flatMap((g) => g.items.map((i) => i.uid))) ===
    JSON.stringify(flatItems.map((i) => i.uid)));
const many = Array.from({ length: 2000 }, (_, i) =>
  toEntry(member(`u${String(i).padStart(4, '0')}`, { displayName: `Guest ${i}` })));
check('2000 members group without loss', buildGuestGroups(many, '').flatMap((g) => g.items).length === 2000);

console.log('\nrow chunking invariants:');
// Conservation is the point: a guest dropped by chunk() is a guest who does not
// appear at the wedding, with nothing on screen to say so.
const ROW_INPUT = Array.from({ length: 17 }, (_, i) => `u${i}`);
for (const columns of [1, 2, 3, 4, 5, 17, 18]) {
  const rows = chunk(ROW_INPUT, columns);
  const flat = rows.flat();
  check(`columns=${columns}: every member appears exactly once, in order`,
    flat.length === ROW_INPUT.length && flat.every((u, i) => u === ROW_INPUT[i]));
  check(`columns=${columns}: no row is empty or wider than the column count`,
    rows.every((r) => r.length > 0 && r.length <= columns));
}
// `NaN < 1` is false, so the old guard was skipped and `i += NaN` never
// advanced — chunk returned [[]] and a whole section vanished silently.
check('a NaN column count does not silently empty the section',
  chunk(ROW_INPUT, NaN).flat().length === ROW_INPUT.length);
check('every declared variant maps to at least two columns',
  Object.values(COLUMNS_BY_VARIANT).every((n) => Number.isInteger(n) && n >= 2));

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
