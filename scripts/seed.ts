import * as admin from 'firebase-admin';
import * as path from 'path';
import { ensureSeedUser, phoneFor } from './seedIdentities';

const keyPath = path.join(__dirname, '..', 'serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(keyPath),
  storageBucket: 'our-day-39d9d.firebasestorage.app',
});

const db = admin.firestore();
const auth = admin.auth();

const WEDDING_ID  = 'seed-wedding-001';
const GUEST_CODE  = 'VOWED-GUEST';
const HOST_CODE   = 'VOWED-HOST';

// The wedding date is computed relative to whenever this script runs, so the
// seed can never go stale again — pushing it to another fixed future date
// just defers the same problem. seed-wedding-002 uses a much shorter runway
// (see scripts/seed2.ts) so the two seed weddings exercise a long and a short
// countdown instead of being interchangeable.
const WEDDING_OFFSET_DAYS = 120;
// Welcome Cocktails (the earliest schedule event) is two days before the
// wedding — see the `events` array below.
const FIRST_EVENT_OFFSET_DAYS = -2;
// Matches the exact ceremony instant used for the "Wedding Ceremony" schedule
// event below, so weddingDateTimeUTC and that event's startTime always agree.
const CEREMONY_UTC_HOUR = 15;
const CEREMONY_UTC_MINUTE = 30;

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
// December 2026"), and a seed script is a good place to stop compounding that.
// Every formatter is pinned to the UTC calendar day (matches weddingDateISO)
// rather than a reader-dependent local day — see lib/weddingConfig.ts's
// formatWeddingDateLong for why that distinction matters.
function formatDateStamp(date: Date): string {
  // "September 5, 2026"
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(date);
}

function formatShortDate(date: Date): string {
  // "Sep 5"
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(date);
}

function formatDisplayDate(date: Date): string {
  // "Saturday, 5 September 2026"
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
const HASHTAG = `#CarterBennett${weddingDate.getUTCFullYear()}`;

// Every schedule-event instant below is built directly in UTC from the
// computed wedding date — no local-offset assumption (the old `ts()` helper
// hardcoded `+01:00` for every venue regardless of where it actually is), and
// no bare `T12:00:00` with no zone either. `dayOffset` is relative to the
// wedding day; `utcHour`/`utcMinute` are explicit UTC clock values.
function eventTimestamp(dayOffset: number, utcHour: number, utcMinute: number) {
  return admin.firestore.Timestamp.fromDate(new Date(Date.UTC(
    weddingDate.getUTCFullYear(),
    weddingDate.getUTCMonth(),
    weddingDate.getUTCDate() + dayOffset,
    utcHour,
    utcMinute,
    0,
    0,
  )));
}

const GUESTS = [
  // partyRole drives the guest-list sections. Noah is deliberately left without
  // one so the "absent means guest" path is exercised by the seed rather than
  // only in theory.
  { email: 'sophia.lane@example.com',   displayName: 'Sophia Lane',    howTheyKnow: "Olivia's maid of honour",    avatar: 'https://randomuser.me/api/portraits/women/44.jpg', isSingle: true,  partyRole: 'bridalParty' },
  { email: 'ethan.brooks@example.com',  displayName: 'Ethan Brooks',   howTheyKnow: "James's best man",           avatar: 'https://randomuser.me/api/portraits/men/32.jpg',   isSingle: false, partyRole: 'bridalParty' },
  { email: 'maya.patel@example.com',    displayName: 'Maya Patel',     howTheyKnow: "Olivia's college roommate",  avatar: 'https://randomuser.me/api/portraits/women/68.jpg', isSingle: true,  partyRole: 'bridalParty' },
  { email: 'lucas.wright@example.com',  displayName: 'Lucas Wright',   howTheyKnow: "James's childhood friend",   avatar: 'https://randomuser.me/api/portraits/men/55.jpg',   isSingle: false, partyRole: 'guest' },
  { email: 'chloe.morgan@example.com',  displayName: 'Chloe Morgan',   howTheyKnow: "Olivia's sister",            avatar: 'https://randomuser.me/api/portraits/women/21.jpg', isSingle: false, partyRole: 'family' },
  { email: 'noah.davis@example.com',    displayName: 'Noah Davis',     howTheyKnow: "Work colleague of James's",  avatar: 'https://randomuser.me/api/portraits/men/76.jpg',   isSingle: true  },
] as const;

const HOST = {
  email: 'james.carter@example.com',
  displayName: 'James Carter',
  howTheyKnow: 'The groom',
  avatar: 'https://randomuser.me/api/portraits/men/11.jpg',
};

// The other half of the couple. A real wedding has two of these and the guest
// list renders a 'Couple' section from partyRole, so seeding only the creator
// left the bride missing from her own wedding. She is a host, not a guest:
// both halves administer in practice, and role is authorization while
// partyRole is only how the guest list groups people.
const PARTNER = {
  email: 'olivia.bennett@example.com',
  displayName: 'Olivia Bennett',
  howTheyKnow: 'The bride',
  avatar: 'https://randomuser.me/api/portraits/women/65.jpg',
};

const POSTS = [
  {
    type: 'photo',
    caption: 'Welcome to Tuscany! The estate is absolutely breathtaking 🌿',
    imageURL: 'https://images.unsplash.com/photo-1523531294919-4bcd7c65e216?w=800',
    pinned: true,
  },
  {
    type: 'photo',
    caption: 'The chapel has been dressed for tomorrow. We can\'t wait to see you all there 💍',
    imageURL: 'https://images.unsplash.com/photo-1519741497674-611481863552?w=800',
    pinned: false,
  },
  {
    type: 'announcement',
    caption: '📍 Shuttle buses depart from the main villa entrance at 4:00 PM sharp. Please don\'t be late!',
    imageURL: null,
    pinned: true,
  },
  {
    type: 'photo',
    caption: 'The vineyard at golden hour ✨ Cocktail hour starts here tonight',
    imageURL: 'https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?w=800',
    pinned: false,
  },
  {
    type: 'photo',
    caption: 'Table settings are done — every detail has been hand picked with love 🕯️',
    imageURL: 'https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?w=800',
    pinned: false,
  },
  {
    type: 'announcement',
    caption: '🎶 Tonight\'s playlist has been curated by the couple — expect everything from Dean Martin to Dua Lipa.',
    imageURL: null,
    pinned: false,
  },
  {
    type: 'photo',
    caption: 'Rehearsal dinner was magical. Feeling so grateful for everyone who travelled to be here 🍾',
    imageURL: 'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=800',
    pinned: false,
  },
  {
    type: 'photo',
    caption: 'Morning light over the olive grove. Today is the day! 🌅',
    imageURL: 'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=800',
    pinned: false,
  },
];

const COMMENTS: Record<number, string[]> = {
  0: ['So excited to be here!!', 'This place is unreal 😍', 'Pinch me!!'],
  1: ['Absolutely stunning 😭', 'Going to cry so hard tomorrow'],
  3: ['Golden hour goals ✨', 'Can\'t wait for cocktail hour!', 'The vines are incredible'],
  4: ['Every detail is perfect 🕯️', 'So beautiful!'],
  6: ['Last night was the best dinner I\'ve ever had', 'The speeches were everything 😂❤️'],
  7: ['TODAY\'S THE DAY!! 🎉', 'So beautiful!! ☀️', 'See you at the aisle! 💍'],
};

// Phone-number identity, not email/password — see scripts/seedIdentities.ts
async function createUser(email: string) {
  return ensureSeedUser(auth, email);
}

async function seed() {
  console.log('Seeding database...\n');

  // ── Host (created first so ownerUid is available for the wedding doc) ─────
  const hostUser = await createUser(HOST.email);

  // ── Wedding document ──────────────────────────────────────────────────────
  await db.doc(`weddings/${WEDDING_ID}`).set({
    weddingId: WEDDING_ID,
    coupleName: 'James & Olivia',
    coupleNameFull: 'James Carter & Olivia Bennett',
    person1First: 'James',
    person2First: 'Olivia',
    monogramInitials: 'JO',
    weddingDateISO: WEDDING_DATE_ISO,
    weddingDateTimeUTC: WEDDING_DATE_TIME_UTC,
    firstEventDateISO: FIRST_EVENT_DATE_ISO,
    dateStamp: DATE_STAMP,
    shortDate: SHORT_DATE,
    displayDate: DISPLAY_DATE,
    venue: 'The Rosewood Estate · Tuscany',
    venueShort: 'Rosewood Estate',
    location: 'Tuscany, Italy',
    hashtag: HASHTAG,
    registryUrl: 'https://www.amazon.com',
    accentHex: '#7A4A3F',
    accentDeepHex: '#5C3329',
    accentSoftHex: '#C58A7A',
    accentTintHex: '#F1DFD6',
    coverPhotoURL: 'https://images.unsplash.com/photo-1523531294919-4bcd7c65e216?w=1200',
    guestInviteCode: GUEST_CODE,
    hostInviteCode: HOST_CODE,
    ownerUid: hostUser.uid,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  console.log('✓ Wedding document');

  // ── Invite codes ──────────────────────────────────────────────────────────
  const preview = { coupleName: 'James & Olivia', dateStamp: DATE_STAMP, venue: 'Rosewood Estate', monogramInitials: 'JO' };
  await db.doc(`weddingsByCode/${GUEST_CODE}`).set({ weddingId: WEDDING_ID, role: 'guest', preview });
  await db.doc(`weddingsByCode/${HOST_CODE}`).set({ weddingId: WEDDING_ID, role: 'host', preview });
  console.log('✓ Invite codes');

  await db.doc(`weddings/${WEDDING_ID}/members/${hostUser.uid}`).set({
    displayName: HOST.displayName,
    photoURL: HOST.avatar,
    howTheyKnow: HOST.howTheyKnow,
    role: 'host',
    // The creator is one half of the couple — confirm.tsx stamps this on real
    // weddings, so the seed mirrors it.
    partyRole: 'couple',
    fcmToken: null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  await db.doc(`users/${hostUser.uid}`).set({ weddingIds: [WEDDING_ID], createdAt: admin.firestore.FieldValue.serverTimestamp() });
  console.log(`✓ Host: ${HOST.displayName} (${HOST.email})`);

  // ── The other half of the couple ──────────────────────────────────────────
  const partnerUser = await createUser(PARTNER.email);
  await db.doc(`weddings/${WEDDING_ID}/members/${partnerUser.uid}`).set({
    displayName: PARTNER.displayName,
    photoURL: PARTNER.avatar,
    howTheyKnow: PARTNER.howTheyKnow,
    role: 'host',
    partyRole: 'couple',
    fcmToken: null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  await db.doc(`users/${partnerUser.uid}`).set({ weddingIds: [WEDDING_ID], createdAt: admin.firestore.FieldValue.serverTimestamp() });
  console.log(`✓ Host: ${PARTNER.displayName} (${PARTNER.email})`);

  // ── Guests ────────────────────────────────────────────────────────────────
  const guestUids: string[] = [];
  for (const g of GUESTS) {
    const user = await createUser(g.email);
    guestUids.push(user.uid);
    await db.doc(`weddings/${WEDDING_ID}/members/${user.uid}`).set({
      displayName: g.displayName,
      photoURL: g.avatar,
      howTheyKnow: g.howTheyKnow,
      role: 'guest',
      isSingle: g.isSingle,
      // Absent for guests with no partyRole, matching how real docs look.
      ...('partyRole' in g ? { partyRole: g.partyRole } : {}),
      fcmToken: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    await db.doc(`users/${user.uid}`).set({ weddingIds: [WEDDING_ID], createdAt: admin.firestore.FieldValue.serverTimestamp() });
    console.log(`✓ Guest: ${g.displayName}`);
  }

  // ── Schedule ──────────────────────────────────────────────────────────────
  const events = [
    { order: 0, title: 'Welcome Cocktails',  location: 'Vineyard · Rosewood Estate',       description: 'Sunset drinks and canapés among the vines.',             startTime: eventTimestamp(-2, 17, 30), icon: '🥂', color: 'sky',    primary: false, dress: 'Smart casual' },
    { order: 1, title: 'Rehearsal Dinner',   location: 'Villa Dining Room · Rosewood',     description: 'An intimate dinner for the wedding party and family.',    startTime: eventTimestamp(-1, 18, 0),  icon: '🕯️', color: 'sand',   primary: false, dress: 'Cocktail' },
    { order: 2, title: 'Morning of Beauty',  location: 'Bridal Suite · Rosewood Estate',   description: 'Hair, makeup, and getting-ready with the bridal party.',  startTime: eventTimestamp(0, 8, 0),    icon: '✨', color: 'accent', primary: false, dress: 'Comfortable' },
    { order: 3, title: 'Wedding Ceremony',   location: 'Chapel Garden · Rosewood Estate',  description: 'Please be seated 15 minutes before the ceremony.',       startTime: eventTimestamp(0, CEREMONY_UTC_HOUR, CEREMONY_UTC_MINUTE), icon: '💍', color: 'accent', primary: true,  dress: 'Black tie' },
    { order: 4, title: 'Reception Dinner',   location: 'Grand Terrace · Rosewood Estate',  description: 'Dinner, toasts, and dancing under the Tuscan stars.',    startTime: eventTimestamp(0, 19, 0),   icon: '🍾', color: 'sky',    primary: false, dress: 'Black tie' },
    { order: 5, title: 'Farewell Brunch',    location: 'Olive Grove · Rosewood Estate',    description: 'A relaxed farewell brunch before guests head home.',     startTime: eventTimestamp(1, 10, 0),   icon: '☀️', color: 'sand',   primary: false, dress: 'Casual' },
  ];
  const schedBatch = db.batch();
  for (const e of events) schedBatch.set(db.collection(`weddings/${WEDDING_ID}/schedule`).doc(), e);
  await schedBatch.commit();
  console.log(`✓ ${events.length} schedule events`);

  // ── Posts + comments + likes ──────────────────────────────────────────────
  for (let i = 0; i < POSTS.length; i++) {
    const p = POSTS[i];
    const postRef = db.collection(`weddings/${WEDDING_ID}/posts`).doc();
    await postRef.set({
      type: p.type,
      caption: p.caption,
      photoURL: p.imageURL,
      authorId: hostUser.uid,
      authorName: HOST.displayName,
      authorPhotoURL: HOST.avatar,
      pinned: p.pinned,
      // Seeded at zero and left to the Cloud Functions, exactly as a real post
      // is. Writing a count here AND creating the like/comment documents below
      // double-counts: onLikeCreated and onCommentCreated fire on those writes
      // and increment on top of the seeded value. seed2.ts already did this
      // correctly; this one left every seeded post reading twice its real
      // engagement.
      likeCount: 0,
      commentCount: 0,
      createdAt: admin.firestore.Timestamp.fromMillis(Date.now() - (POSTS.length - i) * 3600000),
    });

    // Comments
    if (COMMENTS[i]) {
      for (let j = 0; j < COMMENTS[i].length; j++) {
        const commenter = GUESTS[j % GUESTS.length];
        const commenterUid = guestUids[j % guestUids.length];
        await postRef.collection('comments').add({
          text: COMMENTS[i][j],
          authorId: commenterUid,
          authorName: commenter.displayName,
          authorPhotoURL: commenter.avatar,
          createdAt: admin.firestore.Timestamp.fromMillis(Date.now() - (POSTS.length - i) * 3600000 + (j + 1) * 300000),
        });
      }
    }

    // Likes — random subset of guests
    const likers = guestUids.filter((_, idx) => (i + idx) % 2 === 0);
    for (const uid of likers) {
      const liker = GUESTS[guestUids.indexOf(uid)];
      await postRef.collection('likes').doc(uid).set({
        likedAt: admin.firestore.FieldValue.serverTimestamp(),
        displayName: liker.displayName,
        photoURL: liker.avatar,
      });
    }

    console.log(`✓ Post ${i + 1}/${POSTS.length}: "${p.caption.slice(0, 40)}..."`);
  }

  console.log('\n────────────────────────────────────────');
  console.log('Guest code:    VOWED-GUEST');
  console.log('Host code:     VOWED-HOST');
  console.log(`Host account:  ${HOST.email} → ${phoneFor(HOST.email)}`);
  console.log('Sign-in:       phone + SMS code. The default numbers are in the');
  console.log('               reserved +1 (212) 555-01xx fiction range and cannot');
  console.log('               receive SMS — set SEED_PHONE_JAMES_CARTER to a phone');
  console.log('               you control and re-run to sign in as the host.');
  console.log('────────────────────────────────────────');
}

seed().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
