/**
 * Backfills displayName + photoURL into every like doc that is missing them.
 *
 * Like docs are at: weddings/{weddingId}/posts/{postId}/likes/{uid}
 * Member data lives at: weddings/{weddingId}/members/{uid}
 *
 * Run: npx tsx scripts/backfill-likes.ts
 */
import * as admin from 'firebase-admin';
import * as path from 'path';

const keyPath = path.join(__dirname, '..', 'serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(keyPath),
});

const db = admin.firestore();

async function backfill() {
  const weddingsSnap = await db.collection('weddings').get();
  let updated = 0;
  let skipped = 0;

  for (const weddingDoc of weddingsSnap.docs) {
    const weddingId = weddingDoc.id;
    const postsSnap = await db.collection(`weddings/${weddingId}/posts`).get();

    for (const postDoc of postsSnap.docs) {
      const postId = postDoc.id;
      const likesSnap = await db.collection(`weddings/${weddingId}/posts/${postId}/likes`).get();

      for (const likeDoc of likesSnap.docs) {
        const uid = likeDoc.id;
        const data = likeDoc.data();

        if (data.displayName) {
          skipped++;
          continue;
        }

        const memberSnap = await db.doc(`weddings/${weddingId}/members/${uid}`).get();
        if (!memberSnap.exists) {
          console.warn(`  ⚠️  No member doc for uid=${uid} in wedding=${weddingId}`);
          skipped++;
          continue;
        }

        const member = memberSnap.data()!;
        await likeDoc.ref.update({
          displayName: member.displayName ?? '',
          photoURL: member.photoURL ?? null,
        });

        console.log(`  ✓ ${weddingId} / post ${postId.slice(0, 8)}… / ${member.displayName}`);
        updated++;
      }
    }
  }

  console.log(`\nDone. Updated: ${updated}  Skipped (already had data): ${skipped}`);
}

backfill().catch((err) => {
  console.error(err);
  process.exit(1);
});
