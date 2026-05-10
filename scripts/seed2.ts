import * as admin from 'firebase-admin';
import * as path from 'path';

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
const PASSWORD    = 'Vowed123!';

function ts(iso: string) {
  return admin.firestore.Timestamp.fromDate(new Date(`${iso}+01:00`));
}

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

async function seed2() {
  console.log('Seeding seed-wedding-002...\n');

  await db.doc(`weddings/${WEDDING_ID}`).set({
    weddingId: WEDDING_ID,
    coupleName: 'Emma & Ryan',
    coupleNameFull: 'Emma Shaw & Ryan Torres',
    person1First: 'Emma',
    person2First: 'Ryan',
    monogramInitials: 'E&R',
    weddingDateISO: '2026-07-18',
    firstEventDateISO: '2026-07-17',
    dateStamp: 'July 18, 2026',
    shortDate: 'Jul 18',
    displayDate: 'Saturday, 18 July 2026',
    venue: 'The Glass House · Lake Como',
    venueShort: 'Glass House',
    location: 'Lake Como, Italy',
    hashtag: '#ShawTorres2026',
    registryUrl: null,
    accentHex: '#3B6B8A',
    accentDeepHex: '#2A4F6A',
    accentSoftHex: '#7AAFC8',
    accentTintHex: '#D8EBF4',
    coverPhotoURL: 'https://images.unsplash.com/photo-1534430480872-3498386e7856?w=1200',
    guestInviteCode: GUEST_CODE,
    hostInviteCode: HOST_CODE,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    ownerUid: '',
  });
  console.log('✓ Wedding document');

  const preview = {
    coupleName: 'Emma & Ryan',
    dateStamp: 'July 18, 2026',
    venue: 'The Glass House · Lake Como',
    monogramInitials: 'E&R',
  };
  await db.doc(`weddingsByCode/${GUEST_CODE}`).set({ weddingId: WEDDING_ID, role: 'guest', preview });
  await db.doc(`weddingsByCode/${HOST_CODE}`).set({ weddingId: WEDDING_ID, role: 'host', preview });
  console.log('✓ Invite codes');

  // Host
  const hostUser = await createUser(HOST.email);
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
    { caption: 'Lake Como in July — we still can\'t believe this is happening 💙', imageURL: 'https://images.unsplash.com/photo-1534430480872-3498386e7856?w=800', pinned: true },
    { caption: 'Ceremony rehearsal done. See you all tomorrow! 🥂', imageURL: null, pinned: false },
  ];
  for (const p of posts) {
    await db.collection(`weddings/${WEDDING_ID}/posts`).add({
      type: p.imageURL ? 'photo' : 'announcement',
      caption: p.caption,
      imageURL: p.imageURL,
      authorId: hostUser.uid,
      authorName: HOST.displayName,
      authorPhotoURL: HOST.avatar,
      pinned: p.pinned,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
  console.log(`✓ ${posts.length} posts`);

  console.log('\n────────────────────────────────────────');
  console.log('Wedding 2: Emma & Ryan · Lake Como');
  console.log('Guest code:    VOWED2-GUEST');
  console.log('Host code:     VOWED2-HOST');
  console.log(`Host login:    ${HOST.email} / ${PASSWORD}`);
  console.log('Shared guest:  sophia.lane@example.com / Vowed123! (in both weddings)');
  console.log('────────────────────────────────────────');
}

seed2().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
