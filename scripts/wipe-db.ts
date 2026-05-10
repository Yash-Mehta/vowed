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
const storage = admin.storage();

const SEED_WEDDINGS = [
  { id: 'seed-wedding-001', guestCode: 'VOWED-GUEST',  hostCode: 'VOWED-HOST'  },
  { id: 'seed-wedding-002', guestCode: 'VOWED2-GUEST', hostCode: 'VOWED2-HOST' },
];

const SEED_EMAILS = [
  // wedding-001
  'james.carter@example.com',
  'sophia.lane@example.com',
  'ethan.brooks@example.com',
  'maya.patel@example.com',
  'lucas.wright@example.com',
  'chloe.morgan@example.com',
  'noah.davis@example.com',
  // wedding-002
  'emma.shaw@example.com',
  'liam.chen@example.com',
  'ava.jones@example.com',
  'oliver.park@example.com',
  // empty test user
  'test.empty@example.com',
];

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

async function wipeWedding(id: string, guestCode: string, hostCode: string) {
  console.log(`\nWiping ${id}...`);
  const weddingPath = `weddings/${id}`;

  await deleteSubcollection(weddingPath, 'members');
  await deleteSubcollection(weddingPath, 'schedule');

  const postsSnap = await db.collection(`${weddingPath}/posts`).get();
  for (const postDoc of postsSnap.docs) {
    await deleteSubcollection(`${weddingPath}/posts/${postDoc.id}`, 'comments');
    await deleteSubcollection(`${weddingPath}/posts/${postDoc.id}`, 'likes');
    await postDoc.ref.delete();
  }
  if (postsSnap.size) console.log(`  deleted ${postsSnap.size} posts`);

  await db.doc(weddingPath).delete();
  console.log(`  deleted weddings/${id}`);

  await db.doc(`weddingsByCode/${guestCode}`).delete();
  await db.doc(`weddingsByCode/${hostCode}`).delete();
  console.log(`  deleted invite codes ${guestCode}, ${hostCode}`);

  await deleteStorageFolder(`weddings/${id}/`);
}

async function main() {
  console.log('Wiping all seed data...');

  for (const w of SEED_WEDDINGS) {
    await wipeWedding(w.id, w.guestCode, w.hostCode);
  }

  // Delete seed auth users + their index docs
  const uids: string[] = [];
  for (const email of SEED_EMAILS) {
    try {
      const u = await admin.auth().getUserByEmail(email);
      uids.push(u.uid);
      await db.doc(`users/${u.uid}`).delete();
    } catch {}
  }
  if (uids.length) {
    await admin.auth().deleteUsers(uids);
    console.log(`\n  deleted ${uids.length} seed auth users`);
  }

  console.log('\nDone. All seed data wiped.');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
