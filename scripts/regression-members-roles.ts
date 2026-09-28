// Regression checks for wedding membership and authorization against real data.
//
// Two axes get checked here, and they must never be confused:
//   - `role`      ('host' | 'guest') is AUTHORIZATION. firestore.rules gates
//     every write in the app on it (see isHost() in firestore.rules).
//   - `partyRole` ('couple' | 'bridalParty' | 'family' | 'guest') and the
//     retired `isCouple` are DISPLAY ONLY (lib/partyRoles.ts). Nothing here
//     may ever treat partyRole as if it authorized anything, and nothing in
//     the app is allowed to either.
//
// Runs through the Admin SDK, which BYPASSES firestore.rules entirely — same
// caveat as regression-posts.ts. That means this suite can see a data shape
// that has drifted, but it cannot prove a live client would actually be
// allowed or refused; regression-rules-live.ts is the only thing that can.
//
// Read-only. Writes nothing, deletes nothing.
//
//   npx tsx scripts/regression-members-roles.ts

import * as admin from 'firebase-admin';
import * as path from 'path';
import { PARTY_ROLE_ORDER } from '../lib/partyRoles';

admin.initializeApp({
  credential: admin.credential.cert(path.join(process.cwd(), 'serviceAccountKey.json')),
});
const db = admin.firestore();
const auth = admin.auth();

let failures = 0;
function check(name: string, ok: boolean, detail = '') {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
}
// Expected drift that is not a defect — printed distinctly so it never gets
// mistaken for a failing assertion, and never touches the exit code.
function info(name: string, detail = '') {
  console.log(`  INFO  ${name}${detail ? ` — ${detail}` : ''}`);
}

const VALID_PARTY_ROLES = new Set<string>(PARTY_ROLE_ORDER);

function chunk<T>(items: readonly T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}

interface MemberRecord {
  weddingId: string;
  uid: string;
  data: FirebaseFirestore.DocumentData;
}

async function run() {
  const weddingsSnap = await db.collection('weddings').get();

  const members: MemberRecord[] = [];
  const hostlessWeddings: string[] = [];

  for (const w of weddingsSnap.docs) {
    const wd = w.data();
    const label = wd.coupleName ?? w.id;
    console.log(`\n${label}  (${w.id})`);

    const membersSnap = await db.collection(`weddings/${w.id}/members`).get();

    // ── Highest-value check: a wedding whose only host left is unadministrable
    // — nobody can ever again manage guests or the schedule, and the only
    // paths that grant 'host' (the admin panel's promote, and claimHostRole)
    // both require an existing host or a valid invite code that a departed
    // host may have taken knowledge of with them. ──────────────────────────
    const hosts = membersSnap.docs.filter((d) => d.data().role === 'host');
    check(
      'has at least one host',
      hosts.length > 0,
      `${hosts.length} host(s) among ${membersSnap.size} member(s)`
    );
    if (hosts.length === 0) hostlessWeddings.push(w.id);

    // ── ownerUid: present, and a real member of its own wedding. This is the
    // literal field firestore.rules' ownsWedding() reads via
    // get(weddings/{id}).data.ownerUid — the field must exist under exactly
    // this name and hold a real uid, or the wedding-create and member-create
    // rules that anchor on it can never have been satisfied honestly. ──────
    const ownerUid: unknown = wd.ownerUid;
    check('ownerUid is present and a non-empty string', typeof ownerUid === 'string' && ownerUid.length > 0, String(ownerUid));
    if (typeof ownerUid === 'string' && ownerUid) {
      const ownerIsMember = membersSnap.docs.some((d) => d.id === ownerUid);
      check(`ownerUid (${ownerUid.slice(0, 6)}…) is itself a member of this wedding`, ownerIsMember);
    }

    for (const m of membersSnap.docs) {
      const md = m.data();
      const uid = m.id;
      members.push({ weddingId: w.id, uid, data: md });

      // partyRole is client-written and firestore.rules deliberately does not
      // constrain its value (see the members/{uid} rule comment) — the guard
      // lives entirely in lib/partyRoles.ts's toPartyRole() at read time. A
      // value outside the known set still renders fine (it falls back to
      // 'guest'), but it means something wrote a value the app's role picker
      // never offers, which is worth knowing about.
      if ('partyRole' in md) {
        check(
          `${uid.slice(0, 6)}… partyRole is a recognised value`,
          typeof md.partyRole === 'string' && VALID_PARTY_ROLES.has(md.partyRole),
          `got ${JSON.stringify(md.partyRole)}`
        );
      }

      // isCouple is retired (see lib/firestore.ts's UserDoc.isCouple comment
      // and firestore.rules, which still blocks client writes to it). Couple
      // status is now exactly partyRole === 'couple', one field with one
      // writer. A surviving isCouple is inert dead data today, but it is
      // exactly the shape that let the old backfill script silently
      // re-promote someone a host had deliberately demoted — worth a report
      // even though nothing currently reads it.
      check(`${uid.slice(0, 6)}… has no legacy isCouple field`, !('isCouple' in md), `isCouple=${JSON.stringify(md.isCouple)}`);
    }
  }

  if (hostlessWeddings.length > 0) {
    console.log(`\n*** ${hostlessWeddings.length} UNADMINISTRABLE WEDDING(S): ${hostlessWeddings.join(', ')} ***`);
  }

  // ── Denormalised profile consistency + users/{uid}.weddingIds ────────────
  console.log('\nprofile fan-out and weddingIds index:');

  const uniqueUids = [...new Set(members.map((m) => m.uid))];
  const userRefs = uniqueUids.map((uid) => db.doc(`users/${uid}`));
  const userDocs = new Map<string, FirebaseFirestore.DocumentData | null>();
  for (const batch of chunk(userRefs, 300)) {
    const snaps = await db.getAll(...batch);
    snaps.forEach((s) => userDocs.set(s.id, s.exists ? s.data()! : null));
  }

  // Actual membership, per uid, built from what we just scanned — this is
  // ground truth, independent of what weddingIds happens to claim.
  const actualMembership = new Map<string, Set<string>>();
  for (const m of members) {
    if (!actualMembership.has(m.uid)) actualMembership.set(m.uid, new Set());
    actualMembership.get(m.uid)!.add(m.weddingId);
  }

  for (const m of members) {
    const user = userDocs.get(m.uid);
    const tag = `${m.uid.slice(0, 6)}… in ${m.weddingId}`;

    check(`${tag}: users/{uid} index doc exists`, user !== null);
    if (!user) continue;

    // Fan-out is one-way (users/{uid} → members/{uid}), driven by
    // onProfileUpdated. Only compare a field when the source (users/{uid})
    // actually holds a value — an account that predates the v1.4.7 global
    // profile migration, or was never edited since, legitimately has no
    // users/{uid}.displayName/photoURL to have fanned out from, and its
    // member doc's own original value is not drift.
    if (typeof user.displayName === 'string') {
      const memberDisplayName: unknown = m.data.displayName;
      check(
        `${tag}: displayName matches users/{uid}`,
        memberDisplayName === user.displayName,
        `member=${JSON.stringify(memberDisplayName)} user=${JSON.stringify(user.displayName)}`
      );
    }
    if ('photoURL' in user) {
      const memberPhoto = 'photoURL' in m.data ? m.data.photoURL : null;
      const userPhoto = user.photoURL ?? null;
      check(`${tag}: photoURL matches users/{uid}`, memberPhoto === userPhoto, `member=${JSON.stringify(memberPhoto)} user=${JSON.stringify(userPhoto)}`);
    }

    // A missing entry means this user cannot see this wedding in the
    // select-wedding picker at all — that is the real defect.
    const weddingIds: unknown = user.weddingIds;
    const claims = Array.isArray(weddingIds) ? (weddingIds as unknown[]) : [];
    check(`${tag}: users/{uid}.weddingIds includes this wedding`, claims.includes(m.weddingId));
  }

  // The reverse direction: weddingIds entries with no matching membership.
  // weddingIds is client-writable and the host's remove-guest flow
  // (leaveWedding / handleRemove) only deletes the member doc — it never
  // touches the departed member's own weddingIds — so a stale EXTRA entry is
  // the expected, harmless result of being removed from a wedding. Report it
  // for visibility, not as a failure.
  for (const uid of uniqueUids) {
    const user = userDocs.get(uid);
    if (!user) continue;
    const weddingIds: unknown = user.weddingIds;
    if (!Array.isArray(weddingIds)) continue;
    const actual = actualMembership.get(uid) ?? new Set<string>();
    const stale = weddingIds.filter((id) => typeof id === 'string' && !actual.has(id));
    if (stale.length > 0) {
      info(`${uid.slice(0, 6)}… has stale weddingIds entr${stale.length === 1 ? 'y' : 'ies'} for a wedding they are no longer a member of`, stale.join(', '));
    }
  }

  // ── Every member uid must correspond to a real Firebase Auth user ────────
  console.log('\nauth existence:');
  const notFound = new Set<string>();
  for (const batch of chunk(uniqueUids, 100)) {
    const result = await auth.getUsers(batch.map((uid) => ({ uid })));
    result.notFound.forEach((id) => {
      if ('uid' in id && id.uid) notFound.add(id.uid);
    });
  }
  check(
    'every member uid has a corresponding Firebase Auth user',
    notFound.size === 0,
    notFound.size > 0 ? `orphaned uid(s): ${[...notFound].join(', ')}` : ''
  );

  console.log(
    `\nscanned ${weddingsSnap.size} wedding(s), ${members.length} membership(s), ${uniqueUids.length} unique user(s)`
  );
  console.log(`${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
