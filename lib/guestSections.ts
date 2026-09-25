// Derivation for the sectioned guest list. Pure — no React, no firebase — so
// the grouping rules can be reasoned about (and later tested) without a
// renderer, and so the screen file stays about layout.
//
// Everything here treats member data as untrusted. These documents are written
// by clients across several app versions: older ones carry none of the newer
// fields, and firestore.rules deliberately does not validate partyRole's value
// (see the comment on the members rule). So every read normalises rather than
// asserts — a missing displayName must not reach Avatar, which splits it.

import { PartyRole, PARTY_ROLE_ORDER, PARTY_ROLE_SECTION_TITLES, toPartyRole } from './partyRoles';
import { UserRole } from './firestore';

export type TileVariant = 'large' | 'medium' | 'compact';

// Structural, not UserDoc: this is what a member doc looks like coming off the
// wire, where any field may be absent or the wrong type.
export interface GuestMember {
  uid: string;
  displayName?: unknown;
  photoURL?: unknown;
  howTheyKnow?: unknown;
  isSingle?: unknown;
  partyRole?: unknown;
  role?: unknown;
}

// Normalised and ready to render — every field is the type it claims to be.
export interface GuestEntry {
  uid: string;
  name: string;
  photoURL: string | null;
  blurb: string;
  isSingle: boolean;
  partyRole: PartyRole;
  // Authorization, normalised alongside the rest. Kept on the same type
  // because it comes off the same untrusted document — but it stays a
  // SEPARATE axis from partyRole, and only this one may ever gate anything.
  role: UserRole;
  searchKey: string;
}

export interface GuestGroup {
  key: PartyRole;
  title: string;
  variant: TileVariant;
  items: GuestEntry[];
}

const VARIANT_BY_ROLE: Record<PartyRole, TileVariant> = {
  couple: 'large',
  bridalParty: 'medium',
  family: 'medium',
  guest: 'compact',
};

export const COLUMNS_BY_VARIANT: Record<TileVariant, number> = {
  large: 2,
  medium: 3,
  compact: 4,
};

// Avatar builds initials with name.split(' '), so an absent name would throw.
// An empty string is no better — it yields no initials and renders a blank
// circle indistinguishable from a broken image.
// \p{Cf} covers the format characters trim() leaves behind — U+200B zero-width
// space, U+200C/D joiners, U+202E right-to-left override. trim() strips U+00A0
// and U+FEFF but not these, so a name made only of them survived as "visually
// empty", which is exactly what this function exists to prevent.
const INVISIBLE = /[\s\p{Cf}]/gu;

function safeName(value: unknown): string {
  if (typeof value !== 'string') return 'Guest';
  const trimmed = value.trim();
  // Test emptiness against the stripped form, but keep the original: a name is
  // only rejected when nothing visible remains.
  return trimmed.replace(INVISIBLE, '') ? trimmed : 'Guest';
}

export function toEntry(member: GuestMember): GuestEntry {
  const name = safeName(member.displayName);
  return {
    uid: member.uid,
    name,
    photoURL: typeof member.photoURL === 'string' ? member.photoURL : null,
    blurb: typeof member.howTheyKnow === 'string' ? member.howTheyKnow : '',
    isSingle: member.isSingle === true,
    partyRole: toPartyRole(member.partyRole),
    // Anything that is not exactly 'host' is a guest. A malformed value must
    // never read as elevated, and previously also counted as neither in the
    // manage tab's host/guest tallies.
    role: member.role === 'host' ? 'host' : 'guest',
    // Precomputed once per snapshot rather than per keystroke.
    searchKey: name.toLowerCase(),
  };
}

// Alphabetical, with uid as tiebreaker so the order is total and stable across
// snapshots. Deliberately not localeCompare: Hermes' Intl support is the kind
// of thing that works in dev and differs in a release build.
function byName(a: GuestEntry, b: GuestEntry): number {
  if (a.searchKey !== b.searchKey) return a.searchKey < b.searchKey ? -1 : 1;
  return a.uid < b.uid ? -1 : 1;
}

export function buildGuestGroups(entries: readonly GuestEntry[], query: string): GuestGroup[] {
  const needle = query.trim().toLowerCase();
  const matched = needle ? entries.filter((e) => e.searchKey.includes(needle)) : entries;

  const groups = PARTY_ROLE_ORDER.map((key) => ({
    key,
    title: PARTY_ROLE_SECTION_TITLES[key],
    variant: VARIANT_BY_ROLE[key],
    // Empty sections are dropped rather than rendered as a heading over a hole:
    // for a guest that reads as an accusatory blank they have no way to fill.
    items: matched.filter((e) => e.partyRole === key).sort(byName),
  })).filter((g) => g.items.length > 0);

  // No special case for the legacy wedding where everyone is unmarked: the
  // section is titled "Guests" either way, which reads correctly whether it
  // stands alone or sits under Couple and Wedding party.
  return groups;
}

// SectionList has no numColumns, so each element of a section's data is a row.
export function chunk<T>(items: readonly T[], size: number): T[][] {
  // Negated so NaN is caught too: `NaN < 1` is false, which skipped the guard
  // and left `i += NaN` never advancing — chunk returned [[]] and the whole
  // section silently disappeared.
  if (!(size >= 1)) return [items.slice()];
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}
