export interface WeddingConfig {
  weddingId: string;
  coupleName: string;
  coupleNameFull: string;
  person1First: string;
  person2First: string;
  monogramInitials: string;
  weddingDate: Date;
  // The intended calendar day, as the couple entered it — "YYYY-MM-DD", no
  // time or timezone attached. Kept alongside weddingDate (an exact INSTANT)
  // because the two answer different questions: weddingDate is used to tell
  // whether the ceremony has happened yet (an instant comparison is correct
  // there); weddingDateISO is used to DISPLAY the day, because reading an
  // instant back as a calendar date is timezone-dependent and this field
  // isn't. See formatWeddingDateLong below.
  weddingDateISO: string;
  firstEventDate: Date;
  dateStamp: string;
  shortDate: string;
  displayDate: string;
  venue: string;
  venueShort: string;
  location: string;
  hashtag: string;
  registryUrl: string | null;
  accentHex: string;
  accentDeepHex: string;
  accentSoftHex: string;
  accentTintHex: string;
  coverPhotoURL: string | null;
  guestInviteCode: string;
  hostInviteCode: string;
}

export function configFromDoc(data: Record<string, any>): WeddingConfig {
  return {
    weddingId: data.weddingId ?? '',
    coupleName: data.coupleName ?? '',
    coupleNameFull: data.coupleNameFull ?? '',
    person1First: data.person1First ?? '',
    person2First: data.person2First ?? '',
    monogramInitials: data.monogramInitials ?? 'Y&V',
    weddingDate: data.weddingDateTimeUTC
      ? new Date(data.weddingDateTimeUTC)
      : data.weddingDateISO
        ? new Date(data.weddingDateISO + 'T12:00:00Z')
        : new Date(),
    weddingDateISO: data.weddingDateISO ?? '',
    firstEventDate: data.firstEventDateISO ? new Date(data.firstEventDateISO + 'T00:00:00Z') : new Date(),
    dateStamp: data.dateStamp ?? '',
    shortDate: data.shortDate ?? '',
    displayDate: data.displayDate ?? '',
    venue: data.venue ?? '',
    venueShort: data.venueShort ?? data.venue ?? '',
    location: data.location ?? '',
    hashtag: data.hashtag ?? '',
    registryUrl: data.registryUrl ?? null,
    accentHex: data.accentHex ?? '#7A4A3F',
    accentDeepHex: data.accentDeepHex ?? '#5C3329',
    accentSoftHex: data.accentSoftHex ?? '#C58A7A',
    accentTintHex: data.accentTintHex ?? '#F1DFD6',
    coverPhotoURL: data.coverPhotoURL ?? null,
    guestInviteCode: data.guestInviteCode ?? '',
    hostInviteCode: data.hostInviteCode ?? '',
  };
}

const LONG_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// Full, non-abbreviated calendar date ("December 18, 2027") for a wedding —
// used once it has happened, when the feed banner's headline states the date
// outright instead of counting down to it.
//
// Formats weddingDateISO directly — string split, no Date object, no
// timezone involved at all. This is deliberate, and NOT the same fix as
// "read weddingDate with UTC getters instead of local ones": weddingDate is
// an exact INSTANT (parsed from weddingDateTimeUTC), and an evening ceremony
// in a timezone behind UTC lands that instant on the NEXT UTC calendar day —
// e.g. an 8pm US-Eastern ceremony is 00:00Z the following day. Reading that
// instant back in UTC would then print the day AFTER the one the couple
// entered, which is just the mirror image of the local-getter bug, not a fix
// for it. weddingDateISO carries no instant and no timezone, so no reader —
// UTC or local — can shift it: it prints exactly the calendar day the couple
// chose.
export function formatWeddingDateLong(weddingDateISO: string, fallbackInstant: Date): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(weddingDateISO);
  if (match) {
    const [, yearStr, monthStr, dayStr] = match;
    const month = LONG_MONTHS[Number(monthStr) - 1];
    if (month) {
      return `${month} ${Number(dayStr)}, ${yearStr}`;
    }
  }
  // Fallback for older wedding docs that predate weddingDateISO being
  // required, or carry a malformed value — configFromDoc already treats the
  // field as optional. Falls back to the ceremony instant read in UTC. This
  // CAN be a day off for a late-evening ceremony in a timezone behind UTC
  // (the exact drift described above) — accepted here only because it beats
  // an empty or thrown headline, and only hits documents missing the
  // intended-calendar-date field entirely.
  const month = LONG_MONTHS[fallbackInstant.getUTCMonth()];
  const day = fallbackInstant.getUTCDate();
  const year = fallbackInstant.getUTCFullYear();
  return `${month} ${day}, ${year}`;
}
