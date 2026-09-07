import * as admin from 'firebase-admin';
import * as path from 'path';
import { ensureSeedUser, phoneFor } from './seedIdentities';

const keyPath = path.join(__dirname, '..', 'serviceAccountKey.json');
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(keyPath),
    storageBucket: 'our-day-39d9d.firebasestorage.app',
  });
}

const auth = admin.auth();
const db = admin.firestore();

const EMAIL = 'test.empty@example.com';

async function seedEmptyUser() {
  // Phone-number identity, not email/password — see scripts/seedIdentities.ts
  const user = await ensureSeedUser(auth, EMAIL);
  console.log('✓ User ready');

  // Ensure the users doc exists but has no weddings
  await db.doc(`users/${user.uid}`).set({ weddingIds: [] }, { merge: true });
  console.log('✓ User index set (empty weddingIds)');

  console.log('\n────────────────────────────────────────');
  console.log('Empty test account');
  console.log(`Email:    ${EMAIL}`);
  console.log(`Phone:    ${phoneFor(EMAIL)}`);
  console.log('Weddings: none — logs in to empty party selection screen');
  console.log('────────────────────────────────────────');
}

seedEmptyUser().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
