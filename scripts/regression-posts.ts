// Regression checks for posts, announcements and comments against real data.
//
// The counters are the point. likeCount and commentCount are NOT written by
// the client — onLikeCreated, onLikeDeleted, onCommentCreated and
// onCommentDeleted maintain them with the Admin SDK, and firestore.rules makes
// them immutable from a client precisely so nothing else can. That means the
// only way they drift from the subcollections they summarise is a Cloud
// Function that failed, and nothing in the app would ever show it: the feed
// renders the counter, not a count.
//
// Runs through the Admin SDK, which BYPASSES firestore.rules and
// storage.rules. It therefore CANNOT catch a write a real client would be
// refused — the missing contentType that broke every photo post is invisible
// from here. regression-upload-contract.ts covers that class; the two suites
// are not interchangeable.
//
// Read-only. Writes nothing, deletes nothing.
//
//   npx tsx scripts/regression-posts.ts
import * as admin from 'firebase-admin';
import * as path from 'path';

admin.initializeApp({
  credential: admin.credential.cert(path.join(process.cwd(), 'serviceAccountKey.json')),
});
const db = admin.firestore();

let failures = 0;
function check(name: string, ok: boolean, detail = '') {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
}

const isStr = (v: unknown) => typeof v === 'string' && v.length > 0;

async function run() {
  const weddings = await db.collection('weddings').get();
  let totalPosts = 0;
  let totalComments = 0;
  let announcements = 0;

  for (const w of weddings.docs) {
    const posts = await db.collection(`weddings/${w.id}/posts`).get();
    if (posts.empty) continue;

    console.log(`\n${w.data().coupleName ?? w.id}  (${posts.size} posts)`);

    for (const doc of posts.docs) {
      const p = doc.data();
      const id = doc.id.slice(0, 6);
      totalPosts++;

      const type = p.type;
      check(`${id} has a valid type`, type === 'photo' || type === 'announcement', String(type));

      // Every one of these is rendered directly. A missing authorName reaches
      // Avatar, which splits it, and takes the whole feed down with it.
      check(`${id} has an authorId`, isStr(p.authorId));
      check(`${id} has an authorName`, isStr(p.authorName), String(p.authorName));
      check(`${id} has a createdAt timestamp`, p.createdAt instanceof admin.firestore.Timestamp);

      const urls: unknown[] = Array.isArray(p.photoURLs) ? p.photoURLs : [];

      if (type === 'announcement') {
        announcements++;
        // compose skips the upload for an announcement; a photo on one means
        // something wrote a post that the compose screen cannot produce.
        check(`${id} announcement carries no photos`, urls.length === 0 && !p.photoURL);
        check(`${id} announcement has a caption`, isStr(p.caption), 'otherwise it renders empty');
      } else {
        // photoURL is the legacy single-photo field and stays the first of
        // photoURLs. PostCard reads photoURLs and falls back to photoURL, so a
        // disagreement shows one photo in the feed and another in the viewer.
        if (urls.length > 0) {
          check(`${id} photoURL matches the first of photoURLs`, p.photoURL === urls[0]);
        }
        check(`${id} every photoURL is a string`, urls.every(isStr));
        // onPostDeleted confines its Storage cleanup to this wedding's prefix
        // because photoURLs is client-written and unvalidated by rules. A URL
        // pointing elsewhere is either a stale record or an attempt to make
        // that function delete someone else's media.
        check(
          `${id} every photo lives under this wedding`,
          urls.every((u) => typeof u === 'string' && u.includes(encodeURIComponent(`weddings/${w.id}/`))),
          'onPostDeleted will not clean up anything outside it'
        );
      }

      // Counters versus the subcollections they summarise.
      const [likes, comments] = await Promise.all([
        db.collection(`weddings/${w.id}/posts/${doc.id}/likes`).count().get(),
        db.collection(`weddings/${w.id}/posts/${doc.id}/comments`).count().get(),
      ]);
      const likeN = likes.data().count;
      const commentN = comments.data().count;
      totalComments += commentN;

      check(
        `${id} likeCount matches the likes subcollection`,
        (p.likeCount ?? 0) === likeN,
        `doc says ${p.likeCount ?? 0}, there are ${likeN}`
      );
      check(
        `${id} commentCount matches the comments subcollection`,
        (p.commentCount ?? 0) === commentN,
        `doc says ${p.commentCount ?? 0}, there are ${commentN}`
      );
      check(`${id} counters are never negative`, (p.likeCount ?? 0) >= 0 && (p.commentCount ?? 0) >= 0);

      const commentDocs = await db.collection(`weddings/${w.id}/posts/${doc.id}/comments`).get();
      for (const c of commentDocs.docs) {
        const cd = c.data();
        check(`${id}/${c.id.slice(0, 4)} comment has text`, isStr(cd.text));
        check(`${id}/${c.id.slice(0, 4)} comment has an authorId`, isStr(cd.authorId));
        check(
          `${id}/${c.id.slice(0, 4)} comment has a createdAt`,
          cd.createdAt instanceof admin.firestore.Timestamp,
          'CommentSheet orders by it; an absent one sorts unpredictably'
        );
      }
    }
  }

  console.log(
    `\nscanned ${totalPosts} post(s) — ${announcements} announcement(s), ` +
    `${totalPosts - announcements} photo post(s), ${totalComments} comment(s)`
  );
  console.log(`${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
