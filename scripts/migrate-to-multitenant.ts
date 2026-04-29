/**
 * One-time migration: copy Yash & Vaani's data from flat collections
 * (posts, schedule, users) into the wedding-scoped structure
 * (weddings/{weddingId}/posts, etc.)
 *
 * Run once with: npx ts-node scripts/migrate-to-multitenant.ts
 *
 * Requires GOOGLE_APPLICATION_CREDENTIALS or a local serviceAccountKey.json
 */

import * as admin from 'firebase-admin';

// ── CONFIG ─────────────────────────────────────────────────────────────────────
// Set this to the weddingId you want to migrate data into.
// This should match the document you manually created (or will create) in /weddings.
const TARGET_WEDDING_ID = 'yash-vaani-2026';

const COUPLE_NAME = 'Yash & Vaani';
const WEDDING_DATE_ISO = '2026-12-05';
const FIRST_EVENT_DATE_ISO = '2026-12-02';
const VENUE = 'Hard Rock Hotel & Casino Punta Cana';
const VENUE_SHORT = 'Hard Rock Punta Cana';
const LOCATION = 'Punta Cana, Dominican Republic';
const GUEST_CODE = 'OURDAY26';
const HOST_CODE = 'HOST2026';
// ──────────────────────────────────────────────────────────────────────────────

admin.initializeApp();
const db = admin.firestore();

async function migrate() {
  console.log(`Migrating to weddingId: ${TARGET_WEDDING_ID}`);

  // 1. Create /weddings/{weddingId} config doc
  await db.doc(`weddings/${TARGET_WEDDING_ID}`).set({
    weddingId: TARGET_WEDDING_ID,
    coupleName: COUPLE_NAME,
    coupleNameFull: COUPLE_NAME,
    person1First: 'Yash',
    person2First: 'Vaani',
    monogramInitials: 'YV',
    weddingDateISO: WEDDING_DATE_ISO,
    firstEventDateISO: FIRST_EVENT_DATE_ISO,
    dateStamp: 'Sat · December 5, 2026',
    shortDate: 'Dec 5, 2026',
    displayDate: 'December 5, 2026',
    venue: VENUE,
    venueShort: VENUE_SHORT,
    location: LOCATION,
    hashtag: '#YashVaaniWedding',
    registryUrl: null,
    accentHex: '#7A4A3F',
    accentDeepHex: '#5C3329',
    accentSoftHex: '#C58A7A',
    accentTintHex: '#F1DFD6',
    coverPhotoURL: null,
    guestInviteCode: GUEST_CODE,
    hostInviteCode: HOST_CODE,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
  console.log('✓ Wedding config created');

  // 2. Create invite code index docs
  await db.doc(`weddingsByCode/${GUEST_CODE}`).set({
    weddingId: TARGET_WEDDING_ID,
    role: 'guest',
    preview: {
      coupleName: COUPLE_NAME,
      dateStamp: 'Dec 5, 2026',
      venue: VENUE_SHORT,
      monogramInitials: 'YV',
    },
  });
  await db.doc(`weddingsByCode/${HOST_CODE}`).set({
    weddingId: TARGET_WEDDING_ID,
    role: 'host',
    preview: {
      coupleName: COUPLE_NAME,
      dateStamp: 'Dec 5, 2026',
      venue: VENUE_SHORT,
      monogramInitials: 'YV',
    },
  });
  console.log('✓ Invite code index created');

  // 3. Migrate /users → /weddings/{weddingId}/members
  const usersSnap = await db.collection('users').get();
  let memberCount = 0;
  for (const userDoc of usersSnap.docs) {
    const data = userDoc.data();
    // Skip user index docs (they have weddingIds array, not displayName)
    if (!data.displayName) continue;
    await db.doc(`weddings/${TARGET_WEDDING_ID}/members/${userDoc.id}`).set(data, { merge: true });
    // Update user index to point to this weddingId
    await db.doc(`users/${userDoc.id}`).set(
      { weddingIds: admin.firestore.FieldValue.arrayUnion(TARGET_WEDDING_ID) },
      { merge: true }
    );
    memberCount++;
  }
  console.log(`✓ Migrated ${memberCount} members`);

  // 4. Migrate /posts → /weddings/{weddingId}/posts (with subcollections)
  const postsSnap = await db.collection('posts').get();
  let postCount = 0;
  for (const postDoc of postsSnap.docs) {
    const data = postDoc.data();
    await db.doc(`weddings/${TARGET_WEDDING_ID}/posts/${postDoc.id}`).set(data, { merge: true });

    // Migrate comments
    const commentsSnap = await db.collection(`posts/${postDoc.id}/comments`).get();
    for (const commentDoc of commentsSnap.docs) {
      await db.doc(
        `weddings/${TARGET_WEDDING_ID}/posts/${postDoc.id}/comments/${commentDoc.id}`
      ).set(commentDoc.data(), { merge: true });
    }

    // Migrate likes
    const likesSnap = await db.collection(`posts/${postDoc.id}/likes`).get();
    for (const likeDoc of likesSnap.docs) {
      await db.doc(
        `weddings/${TARGET_WEDDING_ID}/posts/${postDoc.id}/likes/${likeDoc.id}`
      ).set(likeDoc.data(), { merge: true });
    }

    postCount++;
  }
  console.log(`✓ Migrated ${postCount} posts`);

  // 5. Migrate /schedule → /weddings/{weddingId}/schedule
  const scheduleSnap = await db.collection('schedule').get();
  let eventCount = 0;
  for (const eventDoc of scheduleSnap.docs) {
    await db.doc(`weddings/${TARGET_WEDDING_ID}/schedule/${eventDoc.id}`).set(
      eventDoc.data(), { merge: true }
    );
    eventCount++;
  }
  console.log(`✓ Migrated ${eventCount} schedule events`);

  console.log('\nMigration complete! Old collections are preserved — delete manually once verified.');
}

migrate().catch(console.error);
