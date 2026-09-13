// Resyncs the denormalized displayName/photoURL copy on every like document
// from users/{uid}, the source of truth.
//
// Like docs were never part of onProfileUpdated's fan-out (fixed now), and
// avatars upload to the fixed path avatars/{uid}.jpg — so changing an avatar
// revokes the previous download token and every like written beforehand keeps a
// URL that 403s. The likes sheet renders that URL directly, so those rows show a
// blank circle while still showing the name.
//
// Run once after deploying the fan-out fix:
//   npx tsx scripts/backfill-like-avatars.ts          # report only
//   npx tsx scripts/backfill-like-avatars.ts --write  # apply
import * as admin from 'firebase-admin';
import * as path from 'path';

const APPLY = process.argv.includes('--write');

admin.initializeApp({
  credential: admin.credential.cert(path.join(process.cwd(), 'serviceAccountKey.json')),
});
const db = admin.firestore();

async function backfill() {
  const users = await db.collection('users').get();
  const truth = new Map<string, { displayName: string | null; photoURL: string | null }>();
  users.docs.forEach((d) =>
    truth.set(d.id, {
      displayName: d.data().displayName ?? null,
      photoURL: d.data().photoURL ?? null,
    })
  );

  const weddings = await db.collection('weddings').get();
  let scanned = 0;
  const drifted: { ref: FirebaseFirestore.DocumentReference; update: Record<string, string | null> }[] = [];

  for (const w of weddings.docs) {
    const posts = await db.collection(`weddings/${w.id}/posts`).select().get();
    for (const p of posts.docs) {
      const likes = await p.ref.collection('likes').get();
      for (const l of likes.docs) {
        scanned++;
        const current = truth.get(l.id);
        // A like from someone with no users/{uid} doc (deleted account) is left
        // alone — there is nothing authoritative to copy from.
        if (!current) continue;

        const update: Record<string, string | null> = {};
        if ((l.data().photoURL ?? null) !== current.photoURL) update.photoURL = current.photoURL;
        if (current.displayName && (l.data().displayName ?? null) !== current.displayName) {
          update.displayName = current.displayName;
        }
        if (Object.keys(update).length > 0) drifted.push({ ref: l.ref, update });
      }
    }
  }

  console.log(`scanned ${scanned} like docs`);
  console.log(`${drifted.length} drifted from users/{uid}`);
  drifted.slice(0, 10).forEach((d) => {
    console.log(`  ${d.ref.path.replace(/weddings\/([^/]{6})[^/]*/, 'weddings/$1…')} → ${Object.keys(d.update).join(', ')}`);
  });

  if (!APPLY) {
    console.log('\nreport only — re-run with --write to apply');
    return;
  }
  for (let i = 0; i < drifted.length; i += 400) {
    const batch = db.batch();
    drifted.slice(i, i + 400).forEach((d) => batch.update(d.ref, d.update));
    await batch.commit();
  }
  console.log(`\nupdated ${drifted.length} like docs`);
}

backfill()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
