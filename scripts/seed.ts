import * as admin from 'firebase-admin';
import * as path from 'path';

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
const PASSWORD    = 'Vowed123!';

function ts(iso: string) {
  return admin.firestore.Timestamp.fromDate(new Date(`${iso}+01:00`));
}

const GUESTS = [
  { email: 'sophia.lane@example.com',   displayName: 'Sophia Lane',    howTheyKnow: "Olivia's maid of honour",    avatar: 'https://randomuser.me/api/portraits/women/44.jpg', isSingle: true  },
  { email: 'ethan.brooks@example.com',  displayName: 'Ethan Brooks',   howTheyKnow: "James's best man",           avatar: 'https://randomuser.me/api/portraits/men/32.jpg',   isSingle: false },
  { email: 'maya.patel@example.com',    displayName: 'Maya Patel',     howTheyKnow: "Olivia's college roommate",  avatar: 'https://randomuser.me/api/portraits/women/68.jpg', isSingle: true  },
  { email: 'lucas.wright@example.com',  displayName: 'Lucas Wright',   howTheyKnow: "James's childhood friend",   avatar: 'https://randomuser.me/api/portraits/men/55.jpg',   isSingle: false },
  { email: 'chloe.morgan@example.com',  displayName: 'Chloe Morgan',   howTheyKnow: "Olivia's sister",            avatar: 'https://randomuser.me/api/portraits/women/21.jpg', isSingle: false },
  { email: 'noah.davis@example.com',    displayName: 'Noah Davis',     howTheyKnow: "Work colleague of James's",  avatar: 'https://randomuser.me/api/portraits/men/76.jpg',   isSingle: true  },
];

const HOST = {
  email: 'james.carter@example.com',
  displayName: 'James Carter',
  howTheyKnow: 'The groom',
  avatar: 'https://randomuser.me/api/portraits/men/11.jpg',
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

async function createUser(email: string) {
  try {
    return await auth.createUser({ email, password: PASSWORD, emailVerified: true });
  } catch (e: any) {
    if (e.code === 'auth/email-already-exists') {
      return await auth.getUserByEmail(email);
    }
    throw e;
  }
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
    weddingDateISO: '2026-09-05',
    weddingDateTimeUTC: '2026-09-05T15:30:00.000Z',
    firstEventDateISO: '2026-09-03',
    dateStamp: 'September 5, 2026',
    shortDate: 'Sep 5',
    displayDate: 'Saturday, 5 September 2026',
    venue: 'The Rosewood Estate · Tuscany',
    venueShort: 'Rosewood Estate',
    location: 'Tuscany, Italy',
    hashtag: '#CarterBennett2026',
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
  const preview = { coupleName: 'James & Olivia', dateStamp: 'September 5, 2026', venue: 'Rosewood Estate', monogramInitials: 'JO' };
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
  await db.doc(`users/${hostUser.uid}`).set({ weddingIds: [WEDDING_ID], createdAt: admin.firestore.FieldValue.serverTimestamp() });
  console.log(`✓ Host: ${HOST.displayName} (${HOST.email})`);

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
      fcmToken: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    await db.doc(`users/${user.uid}`).set({ weddingIds: [WEDDING_ID], createdAt: admin.firestore.FieldValue.serverTimestamp() });
    console.log(`✓ Guest: ${g.displayName}`);
  }

  // ── Schedule ──────────────────────────────────────────────────────────────
  const events = [
    { order: 0, title: 'Welcome Cocktails',  location: 'Vineyard · Rosewood Estate',       description: 'Sunset drinks and canapés among the vines.',             startTime: ts('2026-09-03T18:30:00'), icon: '🥂', color: 'sky',    primary: false, dress: 'Smart casual' },
    { order: 1, title: 'Rehearsal Dinner',   location: 'Villa Dining Room · Rosewood',     description: 'An intimate dinner for the wedding party and family.',    startTime: ts('2026-09-04T19:00:00'), icon: '🕯️', color: 'sand',   primary: false, dress: 'Cocktail' },
    { order: 2, title: 'Morning of Beauty',  location: 'Bridal Suite · Rosewood Estate',   description: 'Hair, makeup, and getting-ready with the bridal party.',  startTime: ts('2026-09-05T09:00:00'), icon: '✨', color: 'accent', primary: false, dress: 'Comfortable' },
    { order: 3, title: 'Wedding Ceremony',   location: 'Chapel Garden · Rosewood Estate',  description: 'Please be seated 15 minutes before the ceremony.',       startTime: ts('2026-09-05T16:30:00'), icon: '💍', color: 'accent', primary: true,  dress: 'Black tie' },
    { order: 4, title: 'Reception Dinner',   location: 'Grand Terrace · Rosewood Estate',  description: 'Dinner, toasts, and dancing under the Tuscan stars.',    startTime: ts('2026-09-05T20:00:00'), icon: '🍾', color: 'sky',    primary: false, dress: 'Black tie' },
    { order: 5, title: 'Farewell Brunch',    location: 'Olive Grove · Rosewood Estate',    description: 'A relaxed farewell brunch before guests head home.',     startTime: ts('2026-09-06T11:00:00'), icon: '☀️', color: 'sand',   primary: false, dress: 'Casual' },
  ];
  const schedBatch = db.batch();
  for (const e of events) schedBatch.set(db.collection(`weddings/${WEDDING_ID}/schedule`).doc(), e);
  await schedBatch.commit();
  console.log(`✓ ${events.length} schedule events`);

  // ── Posts + comments + likes ──────────────────────────────────────────────
  for (let i = 0; i < POSTS.length; i++) {
    const p = POSTS[i];
    const postRef = db.collection(`weddings/${WEDDING_ID}/posts`).doc();
    const commentCount = COMMENTS[i]?.length ?? 0;
    const likeCount = guestUids.filter((_, idx) => (i + idx) % 2 === 0).length;
    await postRef.set({
      type: p.type,
      caption: p.caption,
      photoURL: p.imageURL,
      authorId: hostUser.uid,
      authorName: HOST.displayName,
      authorPhotoURL: HOST.avatar,
      pinned: p.pinned,
      likeCount,
      commentCount,
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
  console.log(`Host login:    ${HOST.email} / ${PASSWORD}`);
  console.log('────────────────────────────────────────');
}

seed().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
