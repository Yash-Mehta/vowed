import * as admin from 'firebase-admin';
import * as path from 'path';

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
const PASSWORD = 'Test123!';

async function seedEmptyUser() {
  let user;
  try {
    user = await auth.createUser({ email: EMAIL, password: PASSWORD, emailVerified: true });
    console.log('✓ Created user');
  } catch (e: any) {
    if (e.code === 'auth/email-already-exists') {
      user = await auth.getUserByEmail(EMAIL);
      console.log('✓ User already exists, reusing');
    } else {
      throw e;
    }
  }

  // Ensure the users doc exists but has no weddings
  await db.doc(`users/${user.uid}`).set({ weddingIds: [] }, { merge: true });
  console.log('✓ User index set (empty weddingIds)');

  console.log('\n────────────────────────────────────────');
  console.log('Empty test account');
  console.log(`Email:    ${EMAIL}`);
  console.log(`Password: ${PASSWORD}`);
  console.log('Weddings: none — logs in to empty party selection screen');
  console.log('────────────────────────────────────────');
}

seedEmptyUser().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
