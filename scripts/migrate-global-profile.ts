// One-time migration for the v1.4.7 global-profile change: backfills
// displayName/photoURL onto users/{uid} from each account's most recently
// created member doc, since that data previously only lived per-wedding.
//
// Idempotent — skips any users/{uid} that already has a non-empty
// displayName, so it's safe to re-run after a partial failure.
//
// Usage:
//   npx tsx scripts/migrate-global-profile.ts            # dry run, logs only
//   npx tsx scripts/migrate-global-profile.ts --write     # actually writes

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
const DRY_RUN = !process.argv.includes('--write');

interface MemberCandidate {
  weddingId: string;
  displayName: string;
  photoURL: string | null;
  createdAtMillis: number;
}

async function findCanonicalProfile(
  uid: string,
  weddingIds: string[]
): Promise<MemberCandidate | null> {
  const snaps = await Promise.all(
    weddingIds.map((weddingId) => db.doc(`weddings/${weddingId}/members/${uid}`).get())
  );

  const candidates: MemberCandidate[] = [];
  snaps.forEach((snap, i) => {
    if (!snap.exists) return;
    const data = snap.data()!;
    if (!data.displayName) return;
    const createdAt = data.createdAt as admin.firestore.Timestamp | undefined;
    candidates.push({
      weddingId: weddingIds[i],
      displayName: data.displayName,
      photoURL: data.photoURL ?? null,
      createdAtMillis: createdAt?.toMillis() ?? 0,
    });
  });

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.createdAtMillis - a.createdAtMillis);
  return candidates[0];
}

async function migrate() {
  console.log(DRY_RUN ? 'DRY RUN — no writes will be made (pass --write to apply)\n' : 'WRITE MODE — applying changes\n');

  const usersSnap = await db.collection('users').get();
  console.log(`Found ${usersSnap.size} users/{uid} docs\n`);

  let migrated = 0;
  let skippedAlready = 0;
  let skippedNoWeddings = 0;
  let skippedNoProfile = 0;

  for (const doc of usersSnap.docs) {
    const uid = doc.id;
    const data = doc.data();

    if (data.displayName) {
      skippedAlready++;
      continue;
    }

    const weddingIds: string[] = data.weddingIds ?? [];
    if (weddingIds.length === 0) {
      skippedNoWeddings++;
      continue;
    }

    const canonical = await findCanonicalProfile(uid, weddingIds);
    if (!canonical) {
      skippedNoProfile++;
      console.log(`⚠ ${uid}: has weddingIds but no member doc with a displayName found — skipped`);
      continue;
    }

    console.log(
      `${DRY_RUN ? '[dry]' : '✓'} ${uid}: displayName="${canonical.displayName}" photoURL=${canonical.photoURL ? 'set' : 'null'} (source: ${canonical.weddingId})`
    );

    if (!DRY_RUN) {
      await db.doc(`users/${uid}`).set(
        { displayName: canonical.displayName, photoURL: canonical.photoURL },
        { merge: true }
      );
    }
    migrated++;
  }

  console.log('\n────────────────────────────────────────');
  console.log(`Migrated:              ${migrated}`);
  console.log(`Already had a profile: ${skippedAlready}`);
  console.log(`No weddings:           ${skippedNoWeddings}`);
  console.log(`No member profile:     ${skippedNoProfile}`);
  console.log('────────────────────────────────────────');
  if (DRY_RUN) console.log('\nThis was a dry run. Re-run with --write to apply.');
}

migrate().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
