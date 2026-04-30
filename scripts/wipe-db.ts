import * as admin from 'firebase-admin';
import * as path from 'path';

const keyPath = path.join(__dirname, '..', 'serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(keyPath),
  storageBucket: 'our-day-39d9d.firebasestorage.app',
});
const db = admin.firestore();
const storage = admin.storage();

async function deleteCollection(colPath: string) {
  const col = db.collection(colPath);
  let deleted = 0;
  while (true) {
    const snap = await col.limit(100).get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    deleted += snap.size;
  }
  if (deleted) console.log(`  deleted ${deleted} docs from /${colPath}`);
}

async function deleteCollectionGroup(groupId: string) {
  let deleted = 0;
  while (true) {
    const snap = await db.collectionGroup(groupId).limit(100).get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    deleted += snap.size;
  }
  if (deleted) console.log(`  deleted ${deleted} docs from group:${groupId}`);
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

async function deleteAuthUsers() {
  let deleted = 0;
  let pageToken: string | undefined;
  while (true) {
    const result = await admin.auth().listUsers(1000, pageToken);
    if (!result.users.length) break;
    const uids = result.users.map((u) => u.uid);
    await admin.auth().deleteUsers(uids);
    deleted += uids.length;
    pageToken = result.pageToken;
    if (!pageToken) break;
  }
  if (deleted) console.log(`  deleted ${deleted} auth users`);
}

async function main() {
  console.log('Wiping database...\n');

  // Delete subcollections first (Firestore doesn't auto-delete them)
  await deleteCollectionGroup('posts');
  await deleteCollectionGroup('members');
  await deleteCollectionGroup('schedule');
  await deleteCollectionGroup('comments');
  await deleteCollectionGroup('likes');

  // Top-level collections
  await deleteCollection('weddings');
  await deleteCollection('weddingsByCode');
  await deleteCollection('users');

  // Storage
  await deleteStorageFolder('weddings/');
  await deleteStorageFolder('avatars/');

  // Auth
  await deleteAuthUsers();

  console.log('\nDone. Database is clean.');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
