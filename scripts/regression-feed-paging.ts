// Regression test for the feed's paged read pattern (v1.5.2).
//
// The feed live-subscribes the newest page and fetches older batches with
// startAfter(cursor). That is easy to get subtly wrong — a cursor that skips or
// repeats documents produces a feed with silently missing posts, which nobody
// notices until a guest asks where their photo went.
//
// Replays the exact query semantics against real data and asserts:
//   1. paging returns every post exactly once (no gaps, no duplicates)
//   2. paged order matches a single unpaginated query
//   3. every pinned post is reachable
//
// Uses a deliberately tiny page size so real weddings exercise multiple pages.
//
//   npx tsx scripts/regression-feed-paging.ts
import * as admin from 'firebase-admin';
import * as path from 'path';

const PAGE_SIZE = 3; // small on purpose: forces several pages over real data

admin.initializeApp({
  credential: admin.credential.cert(path.join(process.cwd(), 'serviceAccountKey.json')),
});
const db = admin.firestore();

let failures = 0;
function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? '  PASS' : '  FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
}

async function run() {
  const weddings = await db.collection('weddings').get();

  for (const w of weddings.docs) {
    const postsCol = db.collection(`weddings/${w.id}/posts`);
    const truth = await postsCol.orderBy('createdAt', 'desc').get();
    if (truth.size === 0) continue;

    console.log(`\n${w.data().coupleName ?? w.id}  (${truth.size} posts)`);

    // Replay exactly what the client does: first page, then startAfter on the
    // last loaded document snapshot.
    const paged: string[] = [];
    let cursor: FirebaseFirestore.QueryDocumentSnapshot | null = null;
    let guard = 0;

    for (;;) {
      if (guard++ > 200) {
        check('paging terminates', false, 'exceeded 200 iterations');
        break;
      }
      // Snapshot cursor, matching the client. A field-value cursor would skip
      // every document sharing the boundary timestamp.
      let q = postsCol.orderBy('createdAt', 'desc').limit(PAGE_SIZE);
      if (cursor) q = postsCol.orderBy('createdAt', 'desc').startAfter(cursor).limit(PAGE_SIZE);
      const snap = await q.get();
      if (snap.empty) break;
      snap.docs.forEach((d) => paged.push(d.id));
      cursor = snap.docs[snap.docs.length - 1];
      if (snap.size < PAGE_SIZE) break;
    }

    const truthIds = truth.docs.map((d) => d.id);
    const unique = new Set(paged);

    check('no duplicates across pages', unique.size === paged.length, `${paged.length} fetched, ${unique.size} unique`);
    check(
      'every post reachable by paging',
      truthIds.every((id) => unique.has(id)),
      `missing ${truthIds.filter((id) => !unique.has(id)).length} of ${truthIds.length}`
    );
    check('paged order matches unpaginated order', JSON.stringify(paged) === JSON.stringify(truthIds));

    // Duplicate createdAt values are the specific hazard for a field-value
    // cursor: startAfter(value) excludes every document sharing that value.
    const times = truth.docs.map((d) => d.data().createdAt?.toMillis?.() ?? 0);
    const dupTimes = times.length - new Set(times).size;
    // Informational now that the cursor is snapshot-based: collisions are
    // survivable, but a spike still says photos are landing in the same instant.
    console.log(`  note   createdAt collisions: ${dupTimes} (snapshot cursor handles these)`);

    const pinned = await postsCol.where('pinned', '==', true).get();
    check(
      'pinned posts all reachable',
      pinned.docs.every((d) => unique.has(d.id)),
      `${pinned.size} pinned`
    );
  }

  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
