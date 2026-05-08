import * as admin from 'firebase-admin';
import * as path from 'path';

const keyPath = path.join(__dirname, '..', 'serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(keyPath),
  storageBucket: 'our-day-39d9d.firebasestorage.app',
});
const db = admin.firestore();
const storage = admin.storage();

const WEDDING_ID = 'seed-wedding-001';
const GUEST_CODE = 'VOWED-GUEST';
const HOST_CODE  = 'VOWED-HOST';

async function deleteSubcollection(parent: string, colId: string) {
  let deleted = 0;
  while (true) {
    const snap = await db.collection(`${parent}/${colId}`).limit(100).get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    deleted += snap.size;
  }
  if (deleted) console.log(`  deleted ${deleted} docs from ${parent}/${colId}`);
}

async function deleteStorageFolder(prefix: string) {
  try {
    const bucket = storage.bucket();
    const [files] = await bucket.getFiles({ prefix });
    if (!files.length) return;
    await Promise.all(files.map((f) => f.delete()));
    console.log(`  deleted ${files.length} files from storage:/${prefix}`);
  } catch (e: any) {
    console.log(`  storage:/${prefix} — ${e.message}`);
  }
}

async function main() {
  console.log(`Wiping seed wedding (${WEDDING_ID})...\n`);

  // Subcollections
  const weddingPath = `weddings/${WEDDING_ID}`;
  await deleteSubcollection(weddingPath, 'members');
  await deleteSubcollection(weddingPath, 'schedule');

  // Posts and their subcollections
  const postsSnap = await db.collection(`${weddingPath}/posts`).get();
  for (const postDoc of postsSnap.docs) {
    await deleteSubcollection(`${weddingPath}/posts/${postDoc.id}`, 'comments');
    await deleteSubcollection(`${weddingPath}/posts/${postDoc.id}`, 'likes');
    await postDoc.ref.delete();
  }
  if (postsSnap.size) console.log(`  deleted ${postsSnap.size} posts (with comments/likes)`);

  // Wedding doc
  await db.doc(weddingPath).delete();
  console.log(`  deleted weddings/${WEDDING_ID}`);

  // Invite code docs
  await db.doc(`weddingsByCode/${GUEST_CODE}`).delete();
  await db.doc(`weddingsByCode/${HOST_CODE}`).delete();
  console.log(`  deleted weddingsByCode/${GUEST_CODE}, ${HOST_CODE}`);

  // Delete only seed users (members of seed wedding)
  const seedEmails = [
    'james.carter@example.com',
    'sophia.lane@example.com',
    'ethan.brooks@example.com',
    'maya.patel@example.com',
    'lucas.wright@example.com',
    'chloe.morgan@example.com',
    'noah.davis@example.com',
  ];
  const uids: string[] = [];
  for (const email of seedEmails) {
    try {
      const u = await admin.auth().getUserByEmail(email);
      uids.push(u.uid);
      await db.doc(`users/${u.uid}`).delete();
    } catch {}
  }
  if (uids.length) {
    await admin.auth().deleteUsers(uids);
    console.log(`  deleted ${uids.length} seed auth users`);
  }

  // Storage
  await deleteStorageFolder(`weddings/${WEDDING_ID}/`);

  console.log('\nDone. Seed data wiped.');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
