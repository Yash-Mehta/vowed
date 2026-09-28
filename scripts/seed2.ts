import * as admin from 'firebase-admin';
import * as path from 'path';
import { ensureSeedUser, phoneFor } from './seedIdentities';

const keyPath = path.join(__dirname, '..', 'serviceAccountKey.json');
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(keyPath),
    storageBucket: 'our-day-39d9d.firebasestorage.app',
  });
}

const db = admin.firestore();
const auth = admin.auth();

const WEDDING_ID  = 'seed-wedding-002';
const GUEST_CODE  = 'VOWED2-GUEST';
const HOST_CODE   = 'VOWED2-HOST';

// The wedding date is computed relative to whenever this script runs, so the
// seed can never go stale again — pushing it to another fixed future date
// just defers the same problem. seed-wedding-001 uses a much longer runway
// (see scripts/seed.ts) so the two seed weddings exercise a long and a short
// countdown instead of being interchangeable.
const WEDDING_OFFSET_DAYS = 45;
// The rehearsal is the day before the wedding.
const FIRST_EVENT_OFFSET_DAYS = -1;
const CEREMONY_UTC_HOUR = 15;
const CEREMONY_UTC_MINUTE = 0;

function addDaysUTC(base: Date, days: number): Date {
  return new Date(Date.UTC(
    base.getUTCFullYear(),
    base.getUTCMonth(),
    base.getUTCDate() + days,
    base.getUTCHours(),
    base.getUTCMinutes(),
    base.getUTCSeconds(),
    base.getUTCMilliseconds(),
  ));
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// All three display strings are generated from the computed date rather than
// hand-written — the real database has these disagreeing in format across
// weddings ("December 5, 2026" vs "Fri · July 26, 2024" vs "Saturday, 5
// December 2026"), and a seed script is a good place to stop compounding
// that. Every formatter is pinned to the UTC calendar day (matches
// weddingDateISO) rather than a reader-dependent local day — see
// lib/weddingConfig.ts's formatWeddingDateLong for why that matters.
function formatDateStamp(date: Date): string {
  // "July 18, 2026"
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(date);
}

function formatShortDate(date: Date): string {
  // "Jul 18"
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(date);
}

function formatDisplayDate(date: Date): string {
  // "Saturday, 18 July 2026"
  return new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);
}

const now = new Date();
const weddingDate = new Date(Date.UTC(
  now.getUTCFullYear(),
  now.getUTCMonth(),
  now.getUTCDate() + WEDDING_OFFSET_DAYS,
  CEREMONY_UTC_HOUR,
  CEREMONY_UTC_MINUTE,
  0,
  0,
));
const firstEventDate = addDaysUTC(weddingDate, FIRST_EVENT_OFFSET_DAYS);

const WEDDING_DATE_ISO = isoDate(weddingDate);
const WEDDING_DATE_TIME_UTC = weddingDate.toISOString();
const FIRST_EVENT_DATE_ISO = isoDate(firstEventDate);
const DATE_STAMP = formatDateStamp(weddingDate);
const SHORT_DATE = formatShortDate(weddingDate);
const DISPLAY_DATE = formatDisplayDate(weddingDate);
// hashtag carries the wedding year — derive it instead of hardcoding, or it
// silently contradicts the computed date the moment the year rolls over.
const HASHTAG = `#ShawTorres${weddingDate.getUTCFullYear()}`;

const HOST = {
  email: 'emma.shaw@example.com',
  displayName: 'Emma Shaw',
  howTheyKnow: 'The bride',
  avatar: 'https://randomuser.me/api/portraits/women/33.jpg',
};

// Sophia is in both weddings — use her existing account
const SHARED_GUEST = {
  email: 'sophia.lane@example.com',
  displayName: 'Sophia Lane',
  howTheyKnow: "Emma's maid of honour",
  avatar: 'https://randomuser.me/api/portraits/women/44.jpg',
  isSingle: true,
};

const GUESTS = [
  SHARED_GUEST,
  { email: 'liam.chen@example.com',    displayName: 'Liam Chen',     howTheyKnow: "Ryan's brother",              avatar: 'https://randomuser.me/api/portraits/men/41.jpg',   isSingle: true  },
  { email: 'ava.jones@example.com',    displayName: 'Ava Jones',     howTheyKnow: "Emma's university friend",    avatar: 'https://randomuser.me/api/portraits/women/57.jpg', isSingle: false },
  { email: 'oliver.park@example.com',  displayName: 'Oliver Park',   howTheyKnow: "Ryan's best man",             avatar: 'https://randomuser.me/api/portraits/men/63.jpg',   isSingle: true  },
];

// Phone-number identity, not email/password — see scripts/seedIdentities.ts
async function createUser(email: string) {
  return ensureSeedUser(auth, email);
}

async function seed2() {
  console.log('Seeding seed-wedding-002...\n');

  // ── Host (created first so ownerUid is available for the wedding doc) ─────
  const hostUser = await createUser(HOST.email);

  await db.doc(`weddings/${WEDDING_ID}`).set({
    weddingId: WEDDING_ID,
    coupleName: 'Emma & Ryan',
    coupleNameFull: 'Emma Shaw & Ryan Torres',
    person1First: 'Emma',
    person2First: 'Ryan',
    monogramInitials: 'ER',
    weddingDateISO: WEDDING_DATE_ISO,
    weddingDateTimeUTC: WEDDING_DATE_TIME_UTC,
    firstEventDateISO: FIRST_EVENT_DATE_ISO,
    dateStamp: DATE_STAMP,
    shortDate: SHORT_DATE,
    displayDate: DISPLAY_DATE,
    venue: 'The Glass House · Lake Como',
    venueShort: 'Glass House',
    location: 'Lake Como, Italy',
    hashtag: HASHTAG,
    registryUrl: null,
    accentHex: '#3B6B8A',
    accentDeepHex: '#2A4F6A',
    accentSoftHex: '#7AAFC8',
    accentTintHex: '#D8EBF4',
    coverPhotoURL: 'https://images.unsplash.com/photo-1534430480872-3498386e7856?w=1200',
    guestInviteCode: GUEST_CODE,
    hostInviteCode: HOST_CODE,
    ownerUid: hostUser.uid,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  console.log('✓ Wedding document');

  const preview = {
    coupleName: 'Emma & Ryan',
    dateStamp: DATE_STAMP,
    venue: 'Glass House',
    monogramInitials: 'ER',
  };
  await db.doc(`weddingsByCode/${GUEST_CODE}`).set({ weddingId: WEDDING_ID, role: 'guest', preview });
  await db.doc(`weddingsByCode/${HOST_CODE}`).set({ weddingId: WEDDING_ID, role: 'host', preview });
  console.log('✓ Invite codes');
  await db.doc(`weddings/${WEDDING_ID}/members/${hostUser.uid}`).set({
    displayName: HOST.displayName,
    photoURL: HOST.avatar,
    howTheyKnow: HOST.howTheyKnow,
    role: 'host',
    fcmToken: null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  await db.doc(`users/${hostUser.uid}`).set(
    { weddingIds: admin.firestore.FieldValue.arrayUnion(WEDDING_ID) },
    { merge: true }
  );
  console.log(`✓ Host: ${HOST.displayName} (${HOST.email})`);

  // Guests
  for (const g of GUESTS) {
    const user = await createUser(g.email);
    await db.doc(`weddings/${WEDDING_ID}/members/${user.uid}`).set({
      displayName: g.displayName,
      photoURL: g.avatar,
      howTheyKnow: g.howTheyKnow,
      role: 'guest',
      isSingle: g.isSingle,
      fcmToken: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    // arrayUnion so we don't overwrite existing weddingIds (Sophia is in both)
    await db.doc(`users/${user.uid}`).set(
      { weddingIds: admin.firestore.FieldValue.arrayUnion(WEDDING_ID) },
      { merge: true }
    );
    console.log(`✓ Guest: ${g.displayName}`);
  }

  // A couple of posts
  const posts = [
    { caption: 'Lake Como in July — we still can\'t believe this is happening 💙', photoURL: 'https://images.unsplash.com/photo-1534430480872-3498386e7856?w=800', pinned: true },
    { caption: 'Ceremony rehearsal done. See you all tomorrow! 🥂', photoURL: null, pinned: false },
  ];
  for (const p of posts) {
    await db.collection(`weddings/${WEDDING_ID}/posts`).add({
      type: p.photoURL ? 'photo' : 'announcement',
      caption: p.caption,
      photoURL: p.photoURL,
      authorId: hostUser.uid,
      authorName: HOST.displayName,
      authorPhotoURL: HOST.avatar,
      pinned: p.pinned,
      likeCount: 0,
      commentCount: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
  console.log(`✓ ${posts.length} posts`);

  console.log('\n────────────────────────────────────────');
  console.log('Wedding 2: Emma & Ryan · Lake Como');
  console.log('Guest code:    VOWED2-GUEST');
  console.log('Host code:     VOWED2-HOST');
  console.log(`Host account:  ${HOST.email} → ${phoneFor(HOST.email)}`);
  console.log(`Shared guest:  sophia.lane@example.com → ${phoneFor('sophia.lane@example.com')} (in both weddings)`);
  console.log('────────────────────────────────────────');
}

seed2().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
