// Exercises the DEPLOYED firestore.rules and storage.rules as real signed-in
// users. This is the only thing in this repo that can test the rules at all.
//
// Everything else is blind to them. The Admin SDK bypasses both rulesets, so
// regression-posts.ts and regression-feed-paging.ts cannot see a refusal.
// regression-upload-contract.ts reads source, so it cannot see anything the
// server decides. That gap is not theoretical: photo posting was refused for
// every member for weeks because the Cloud Storage service agent was missing
// roles/firebaserules.firestoreServiceAgent, which made every
// firestore.exists() call in storage.rules deny. Nothing in the codebase could
// observe it, and the only symptom was a generic alert.
//
// This works by minting a custom token locally from serviceAccountKey.json and
// signing in with the CLIENT SDK, so requests are evaluated by the real rules.
// Signing is local — it needs no IAM permission of its own.
//
//   npx tsx scripts/regression-rules-live.ts            # read-only
//   npx tsx scripts/regression-rules-live.ts --write    # also runs the upload canary
//
// The --write canary uploads one 1x1 JPEG to a __canary__ path and deletes it
// again with the Admin SDK in a finally, so nothing survives a failed run.
//
// Assert the PAIR, always: a rule that denies everyone passes a deny-only
// test, and a rule that allows everyone passes an allow-only test. Only member
// ALLOWED plus non-member DENIED says the rule is actually correct.

import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signOut } from 'firebase/auth';
import { getStorage, ref, getMetadata, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

const RUN_WRITES = process.argv.includes('--write');

const env: Record<string, string> = {};
for (const line of fs.readFileSync(path.join(process.cwd(), '.env'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

admin.initializeApp({
  credential: admin.credential.cert(path.join(process.cwd(), 'serviceAccountKey.json')),
});

const client = initializeApp({
  apiKey: env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  appId: env.EXPO_PUBLIC_FIREBASE_APP_ID,
});
const cauth = getAuth(client);
const cstorage = getStorage(client);
const cdb = getFirestore(client);

let failures = 0;
function check(name: string, ok: boolean, detail = '') {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
}

// Smallest valid JPEG, so the canary exercises isImageUnder's contentType and
// size checks without moving real bytes.
const JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a' +
  'HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAA' +
  'AAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==',
  'base64'
);

async function asUser<T>(uid: string, fn: () => Promise<T>): Promise<T> {
  await signInWithCustomToken(cauth, await admin.auth().createCustomToken(uid));
  try {
    return await fn();
  } finally {
    await signOut(cauth);
  }
}

const allowed = async (fn: () => Promise<unknown>) => {
  try {
    await fn();
    return { ok: true, code: '' };
  } catch (e: unknown) {
    return { ok: false, code: (e as { code?: string })?.code ?? String(e) };
  }
};

async function run() {
  // Pick a wedding that actually has post media, and a member and non-member
  // of it — rather than hardcoding uids that rotate with the seed data.
  const adb = admin.firestore();
  const bucket = admin.storage().bucket(env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET);
  const [objects] = await bucket.getFiles({ prefix: 'weddings/' });
  const postObject = objects.find((f) => f.name.includes('/posts/'));
  if (!postObject) {
    console.log('no wedding post media exists yet — nothing to probe');
    process.exit(0);
  }
  const weddingId = postObject.name.split('/')[1];

  const members = await adb.collection(`weddings/${weddingId}/members`).get();
  const memberUid = members.docs[0].id;
  const memberUids = new Set(members.docs.map((d) => d.id));
  const allUsers = await adb.collection('users').get();
  const nonMemberUid = allUsers.docs.map((d) => d.id).find((uid) => !memberUids.has(uid));
  const [avatar] = (await bucket.getFiles({ prefix: 'avatars/', maxResults: 1 }))[0];

  console.log(`wedding ${weddingId} — ${members.size} members`);
  console.log(`  member ${memberUid}`);
  console.log(`  non-member ${nonMemberUid ?? '(none available)'}\n`);

  console.log('a real member:');
  await asUser(memberUid, async () => {
    check(
      'can read the wedding document (firestore, same-service)',
      (await allowed(() => getDoc(doc(cdb, 'weddings', weddingId)))).ok
    );
    const r = await allowed(() => getMetadata(ref(cstorage, postObject.name)));
    check('can read post media (storage, CROSS-SERVICE)', r.ok, r.code);
    if (avatar) {
      check('can read an avatar (control — no cross-service call)',
        (await allowed(() => getMetadata(ref(cstorage, avatar.name)))).ok);
    }
  });

  if (nonMemberUid) {
    console.log('\na signed-in non-member:');
    await asUser(nonMemberUid, async () => {
      const f = await allowed(() => getDoc(doc(cdb, 'weddings', weddingId)));
      check('is refused the wedding document', !f.ok, f.code);
      const s = await allowed(() => getMetadata(ref(cstorage, postObject.name)));
      check('is refused post media', !s.ok, s.code);
      if (avatar) {
        check('can still read avatars, which are deliberately open',
          (await allowed(() => getMetadata(ref(cstorage, avatar.name)))).ok);
      }
    });
  } else {
    console.log('\n(no non-member account exists — the deny half cannot be asserted)');
  }

  if (!RUN_WRITES) {
    console.log('\nread-only. re-run with --write to exercise the upload path.');
    return;
  }

  const canary = `weddings/${weddingId}/posts/__canary__.jpg`;
  const intruder = `weddings/${weddingId}/posts/__intruder__.jpg`;
  console.log('\nupload canary:');
  await asUser(memberUid, async () => {
    const up = await allowed(() => uploadBytes(ref(cstorage, canary), JPEG, { contentType: 'image/jpeg' }));
    check('a member can upload post media', up.ok, up.code);
    if (up.ok) {
      // compose.tsx calls getDownloadURL immediately after uploading, and that
      // read is rules-gated too — an upload that succeeds is not enough.
      const dl = await allowed(() => getDownloadURL(ref(cstorage, canary)));
      check('and can then getDownloadURL, which compose needs next', dl.ok, dl.code);
    }
  });
  if (nonMemberUid) {
    await asUser(nonMemberUid, async () => {
      const up = await allowed(() => uploadBytes(ref(cstorage, intruder), JPEG, { contentType: 'image/jpeg' }));
      check('a non-member is refused the upload', !up.ok, up.code || 'upload succeeded — the rule is open');
    });
  }
}

run()
  .catch((e) => {
    console.error(e);
    failures++;
  })
  .finally(async () => {
    // Admin-SDK cleanup regardless of outcome, so a failed assertion never
    // leaves a canary object behind in a real wedding's feed storage.
    if (RUN_WRITES) {
      const bucket = admin.storage().bucket(env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET);
      const [objects] = await bucket.getFiles({ prefix: 'weddings/' });
      for (const f of objects.filter((o) => o.name.includes('__canary__') || o.name.includes('__intruder__'))) {
        try {
          await f.delete();
          console.log(`  cleaned up ${f.name}`);
        } catch {
          console.log(`  COULD NOT CLEAN UP ${f.name} — delete it by hand`);
        }
      }
    }
    console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
    process.exit(failures === 0 ? 0 : 1);
  });
