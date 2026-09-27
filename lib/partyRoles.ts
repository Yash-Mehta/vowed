// Where a member sits in the wedding, for display only.
//
// This is a SEPARATE axis from `UserRole` ('guest' | 'host') in lib/firestore.ts.
// `role` is authorization: it decides who sees the manage tab and what
// firestore.rules will accept. `partyRole` decides nothing — it groups the guest
// list and labels a badge. Nothing may ever branch UI or permissions on it,
// because a host is simply whoever holds the host invite code, and hosts can set
// partyRole on anyone including themselves.
//
// Constants only — no React, no firebase — so both the host controls and the
// guest list can import it without a cycle.

export type PartyRole = 'couple' | 'bridalParty' | 'family' | 'guest';

// Display order, top to bottom, for the guest-list sections AND the host's role
// picker. Shared so the two can never disagree about ordering.
export const PARTY_ROLE_ORDER: readonly PartyRole[] = [
  'couple',
  'family',
  'bridalParty',
  'guest',
] as const;

export const PARTY_ROLE_LABELS: Record<PartyRole, string> = {
  // "Couple" rather than "Bride & Groom": the latter is wrong for same-sex
  // weddings, and this label is shown to every guest.
  couple: 'Couple',
  // "Wedding party" rather than "Bridal party": "bridal" excludes half of it.
  // Singular register, unlike the section heading below — this one is a badge
  // on one person.
  bridalParty: 'Wedding party',
  family: 'Family',
  guest: 'Guest',
};

// Section headings for the guest list. Written in the couple's voice — these
// are read by their guests, so "Our Family" says something "Family" does not.
// Deliberately NOT the same strings as PARTY_ROLE_LABELS above: a heading sits
// over a group, while a label sits on one person, and "Our Favorite People" on
// a single profile badge would read as a claim about that individual.
export const PARTY_ROLE_SECTION_TITLES: Record<PartyRole, string> = {
  couple: 'Couple',
  family: 'Our Family',
  bridalParty: 'Our Wedding Party',
  // Not "Everyone else": at a wedding that reads as dismissive of the people
  // who travelled to be there.
  guest: 'Our Favorite People',
};

const VALID = new Set<string>(PARTY_ROLE_ORDER);

// Absent means 'guest' — the default is implicit, and member docs are never
// written with partyRole: 'guest' just to make it explicit. Anything
// unrecognised also falls back to 'guest': the field is client-written and
// nothing in firestore.rules constrains its value, so treat it as untrusted.
export function toPartyRole(value: unknown): PartyRole {
  return typeof value === 'string' && VALID.has(value) ? (value as PartyRole) : 'guest';
}
