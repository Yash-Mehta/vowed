// Run with: npx ts-node scripts/seed.ts
// Requires GOOGLE_APPLICATION_CREDENTIALS env var pointing to a service account JSON
// Download from: Firebase Console → Project Settings → Service Accounts → Generate new private key
import * as admin from 'firebase-admin';

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: 'our-day-39d9d',
});

const db = admin.firestore();

function ist(isoLocal: string) {
  // isoLocal is local IST time, e.g. '2026-12-12T16:30:00'
  // IST = UTC+5:30, so subtract 5h30m to get UTC
  const [date, time] = isoLocal.split('T');
  const d = new Date(`${date}T${time}+05:30`);
  return admin.firestore.Timestamp.fromDate(d);
}

async function seed() {
  // ── Invite code ──────────────────────────────────────────────────────────
  await db.doc('config/inviteCode').set({ code: 'OURDAY2026' });
  console.log('✓ Invite code: OURDAY2026');
  await db.doc('config/hostInviteCode').set({ code: 'HOST-OURDAY' });
  console.log('✓ Host invite code: HOST-OURDAY');

  // ── Schedule events ───────────────────────────────────────────────────────
  const events = [
    {
      order: 0,
      title: 'Sunrise Yoga',
      location: 'Garden Terrace · Anantara Villa',
      description: 'Start the wedding weekend with a gentle yoga session by the gardens.',
      startTime: ist('2026-12-10T06:00:00'),
      icon: '🌿',
      color: 'leaf',
      primary: false,
      dress: 'Comfortable wear',
    },
    {
      order: 1,
      title: 'Welcome Cocktails',
      location: 'Infinity Pool · Anantara Villa',
      description: 'Sunset drinks and canapés to welcome guests arriving for the weekend.',
      startTime: ist('2026-12-10T19:00:00'),
      icon: '🥂',
      color: 'sky',
      primary: false,
      dress: 'Smart casual',
    },
    {
      order: 2,
      title: 'Mehendi & Haldi',
      location: 'Garden Terrace · Anantara Villa',
      description: 'Traditional Mehendi and Haldi ceremonies for the bride and close family.',
      startTime: ist('2026-12-11T10:00:00'),
      icon: '✨',
      color: 'sand',
      primary: false,
      dress: 'Traditional / pastels',
    },
    {
      order: 3,
      title: 'Sangeet Night',
      location: 'Grand Pavilion · Anantara Villa',
      description: 'An evening of music, dance, and celebrations with family and friends.',
      startTime: ist('2026-12-11T19:30:00'),
      icon: '🎶',
      color: 'accent',
      primary: false,
      dress: 'Festive Indian wear',
    },
    {
      order: 4,
      title: 'Wedding Ceremony',
      location: 'Grand Lawn · Anantara Villa · Goa',
      description: 'The wedding of Yash & Vaani. Please be seated 15 minutes before the ceremony.',
      startTime: ist('2026-12-12T16:30:00'),
      icon: '💍',
      color: 'accent',
      primary: true,
      dress: 'Formal — Sherwani / Saree / Lehenga',
    },
    {
      order: 5,
      title: 'Reception Dinner',
      location: 'Beach Terrace · Anantara Villa',
      description: 'Join the newly-weds for dinner, toasts, and dancing under the stars.',
      startTime: ist('2026-12-12T20:00:00'),
      icon: '🍾',
      color: 'sky',
      primary: false,
      dress: 'Formal / cocktail',
    },
    {
      order: 6,
      title: 'Farewell Brunch',
      location: 'Spice Restaurant · Anantara Villa',
      description: 'A relaxed farewell brunch before guests head home. Safe travels!',
      startTime: ist('2026-12-13T10:00:00'),
      icon: '☀️',
      color: 'sand',
      primary: false,
      dress: 'Casual',
    },
  ];

  const batch = db.batch();
  for (const event of events) {
    const ref = db.collection('schedule').doc();
    batch.set(ref, event);
  }
  await batch.commit();
  console.log(`✓ Seeded ${events.length} schedule events`);

  console.log('\nDone! Your Firebase project is ready.');
  console.log('Invite code: OURDAY2026');
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
