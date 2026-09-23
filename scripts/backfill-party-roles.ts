// Marks the couple on weddings that existed before party roles.
//
// confirm.tsx now stamps the creator as the couple at creation, so this is
// only for the weddings already in the database. It is not a permanent
// fixture: the host can mark anyone — including their partner — from the role
// sheet in the manage tab, which is the durable answer.
//
//   npx tsx scripts/backfill-party-roles.ts             # report only
//   npx tsx scripts/backfill-party-roles.ts --write     # stamp owners
//   npx tsx scripts/backfill-party-roles.ts --write --partners
//                                                       # also apply unambiguous
//                                                       # name-matched partners
//   npx tsx scripts/backfill-party-roles.ts --write --wedding <id> --uid <uid>
//                                                       # mark one member by hand
//
// A couple is two people and Firestore records one ownerUid. The partner joins
// later with an invite code and is byte-for-byte indistinguishable from any
// other member, so only the owner can be identified with certainty. The
// partner match below is a reported heuristic, never a silent one.
import * as admin from 'firebase-admin';
import * as path from 'path';

const APPLY = process.argv.includes('--write');
const PARTNERS = process.argv.includes('--partners');
const argOf = (flag: string) => {
  const i = process.argv.indexOf(flag);
  return i > -1 ? process.argv[i + 1] : undefined;
};
const ONE_WEDDING = argOf('--wedding');
const ONE_UID = argOf('--uid');

admin.initializeApp({
  credential: admin.credential.cert(path.join(process.cwd(), 'serviceAccountKey.json')),
});
const db = admin.firestore();

const COUPLE = { partyRole: 'couple' as const, isCouple: true };

type Planned = { ref: FirebaseFirestore.DocumentReference; who: string; why: string };

function firstNameTokens(name: unknown): string {
  return typeof name === 'string' ? name.trim().toLowerCase().split(/\s+/)[0] ?? '' : '';
}

async function run() {
  // Manual escape hatch for the ambiguous cases the heuristic refuses to guess.
  if (ONE_WEDDING && ONE_UID) {
    const ref = db.doc(`weddings/${ONE_WEDDING}/members/${ONE_UID}`);
    const snap = await ref.get();
    if (!snap.exists) {
      console.log(`no member doc at ${ref.path}`);
      process.exit(1);
    }
    console.log(`${APPLY ? 'marking' : 'would mark'} ${snap.data()?.displayName ?? ONE_UID} as couple`);
    if (APPLY) await ref.update(COUPLE);
    return;
  }

  const weddings = await db.collection('weddings').get();
  const planned: Planned[] = [];
  const skipped: string[] = [];
  const ambiguous: string[] = [];

  for (const w of weddings.docs) {
    const data = w.data();
    const short = w.id.slice(0, 8);
    const ownerUid: unknown = data.ownerUid;

    if (typeof ownerUid !== 'string' || !ownerUid) {
      // Weddings predating ownerUid exist; one must not kill the whole run.
      skipped.push(`${short}… — no ownerUid`);
      continue;
    }

    const members = await db.collection(`weddings/${w.id}/members`).get();
    const owner = members.docs.find((d) => d.id === ownerUid);

    if (!owner) {
      // Real: leaveWedding and the host's remove control both delete member docs.
      skipped.push(`${short}… — owner is not a member`);
    } else if (owner.data().isCouple !== true || owner.data().partyRole !== 'couple') {
      planned.push({ ref: owner.ref, who: owner.data().displayName ?? ownerUid, why: 'ownerUid' });
    }

    // Partner: match a member's first name against the couple's names on the
    // wedding doc. Only an unambiguous single match is ever offered.
    const names = [firstNameTokens(data.person1First), firstNameTokens(data.person2First)].filter(Boolean);
    if (names.length === 0) continue;
    const candidates = members.docs.filter(
      (d) => d.id !== ownerUid && names.includes(firstNameTokens(d.data().displayName))
    );

    if (candidates.length === 1) {
      const c = candidates[0];
      if (c.data().isCouple !== true) {
        if (PARTNERS) {
          planned.push({ ref: c.ref, who: c.data().displayName ?? c.id, why: 'name match' });
        } else {
          ambiguous.push(`${short}… — ${c.data().displayName ?? c.id} looks like the partner (re-run with --partners)`);
        }
      }
    } else if (candidates.length > 1) {
      // Two guests called Olivia is not hypothetical.
      ambiguous.push(
        `${short}… — ${candidates.length} members match a couple name; mark by hand with --wedding ${w.id} --uid <uid>`
      );
    }
  }

  console.log(`scanned ${weddings.size} weddings`);
  console.log(`${planned.length} member doc(s) to stamp as couple:`);
  planned.forEach((p) => console.log(`  ${p.who}  (${p.why})`));
  if (skipped.length) {
    console.log(`\nskipped:`);
    skipped.forEach((s) => console.log(`  ${s}`));
  }
  if (ambiguous.length) {
    console.log(`\nnot applied automatically:`);
    ambiguous.forEach((a) => console.log(`  ${a}`));
  }

  if (!APPLY) {
    console.log('\nreport only — re-run with --write to apply');
    return;
  }
  for (let i = 0; i < planned.length; i += 400) {
    const batch = db.batch();
    planned.slice(i, i + 400).forEach((p) => batch.update(p.ref, COUPLE));
    await batch.commit();
  }
  console.log(`\nstamped ${planned.length} member doc(s)`);
}

run()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
