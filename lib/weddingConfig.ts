export interface WeddingConfig {
  weddingId: string;
  coupleName: string;
  coupleNameFull: string;
  person1First: string;
  person2First: string;
  monogramInitials: string;
  weddingDate: Date;
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
    weddingDate: data.weddingDateISO ? new Date(data.weddingDateISO) : new Date(),
    firstEventDate: data.firstEventDateISO ? new Date(data.firstEventDateISO) : new Date(),
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
