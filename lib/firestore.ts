import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  FirestoreError,
} from 'firebase/firestore';
import { httpsCallable, FunctionsError } from 'firebase/functions';
import { db, functions } from './firebase';
import type { PartyRole } from './partyRoles';

// Re-exported so call sites that already import from this module don't need a
// second import line for the display role.
export type { PartyRole } from './partyRoles';

export type UserRole = 'guest' | 'host';

export interface UserDoc {
  // displayName/photoURL are a denormalized copy of the global profile
  // (users/{uid}) — set once at creation, then kept in sync by the
  // onProfileUpdated Cloud Function. Never written directly by the edit
  // flow (app/(tabs)/profile.tsx) — that writes users/{uid} via
  // setUserProfile instead, letting the function fan the change out.
  displayName: string;
  photoURL: string | null;
  howTheyKnow: string;
  role: UserRole;
  fcmToken: string | null;
  createdAt: unknown;
  isSingle?: boolean;
  // Where this member sits in the wedding — DISPLAY ONLY. Groups the guest list
  // and labels a badge; it must never gate UI or permissions. `role` above is
  // the authorization axis and stays the only thing that decides what someone
  // can see or do. Absent means 'guest'; read it through toPartyRole(), never
  // with a bare cast, since nothing in firestore.rules constrains the value.
  partyRole?: PartyRole;
  // True for the couple themselves. Set by confirm.tsx for the wedding's
  // creator and by a host for their partner — deliberately NOT derived from
  // `role === 'host'`, because an admin who is not the couple is a real case.
  isCouple?: boolean;
  // Notification preferences — absent means enabled; announcements are always on
  notifyPosts?: boolean;
  notifyComments?: boolean;
}

export interface UserIndexDoc {
  weddingIds: string[];
  createdAt: unknown;
  // Global, account-level profile — set once, reused across every wedding
  // a user joins. Source of truth for displayName/photoURL; the per-wedding
  // UserDoc copy above is denormalized from this.
  displayName?: string;
  photoURL?: string | null;
  // Set via Admin SDK backfill or the verifyPhoneOtp Cloud Function — never
  // written by the client. Display-only; the Auth record's phoneNumber is
  // the source of truth for sign-in.
  phoneNumber?: string | null;
}

export interface CodeIndexDoc {
  weddingId: string;
  role: UserRole;
  preview: {
    coupleName: string;
    dateStamp: string;
    venue: string;
    monogramInitials: string;
  };
}

export interface WeddingPreview {
  weddingId: string;
  coupleName: string;
  dateStamp: string;
}

// Suppress permission-denied errors from Firestore listeners (expected when not a member)
export function onSnapshotError(err: FirestoreError) {
  if (err.code !== 'permission-denied') console.warn(err);
}

// ── Collection factories ───────────────────────────────────────────────────────

export const membersCol = (weddingId: string) =>
  collection(db, 'weddings', weddingId, 'members');

export const postsCol = (weddingId: string) =>
  collection(db, 'weddings', weddingId, 'posts');

export const scheduleCol = (weddingId: string) =>
  collection(db, 'weddings', weddingId, 'schedule');

// ── Member CRUD ────────────────────────────────────────────────────────────────

export async function getMember(weddingId: string, uid: string): Promise<UserDoc | null> {
  const snap = await getDoc(doc(db, 'weddings', weddingId, 'members', uid));
  return snap.exists() ? (snap.data() as UserDoc) : null;
}

export async function createMember(
  weddingId: string,
  uid: string,
  data: Omit<UserDoc, 'createdAt' | 'fcmToken'>
) {
  await setDoc(doc(db, 'weddings', weddingId, 'members', uid), {
    ...data,
    fcmToken: null,
    createdAt: serverTimestamp(),
  });
}

export async function updateMember(weddingId: string, uid: string, data: Partial<UserDoc>) {
  await updateDoc(doc(db, 'weddings', weddingId, 'members', uid), data);
}

// ── User index CRUD ────────────────────────────────────────────────────────────

export async function getUserIndex(uid: string): Promise<UserIndexDoc | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? (snap.data() as UserIndexDoc) : null;
}

export async function addWeddingToIndex(uid: string, weddingId: string) {
  await setDoc(
    doc(db, 'users', uid),
    { weddingIds: arrayUnion(weddingId) },
    { merge: true }
  );
}

// Merge-only — like addWeddingToIndex, must never clobber weddingIds. The
// onProfileUpdated Cloud Function watches this doc and fans displayName/
// photoURL changes out to every wedding's member doc, posts, and comments.
export async function setUserProfile(
  uid: string,
  data: { displayName: string; photoURL: string | null }
) {
  await setDoc(doc(db, 'users', uid), data, { merge: true });
}

export async function getWeddingPreviews(weddingIds: string[]): Promise<WeddingPreview[]> {
  const results = await Promise.all(
    weddingIds.map(async (weddingId) => {
      const snap = await getDoc(doc(db, 'weddings', weddingId));
      if (!snap.exists()) return null;
      const d = snap.data();
      return { weddingId, coupleName: d.coupleName ?? '', dateStamp: d.dateStamp ?? '' };
    })
  );
  return results.filter((r): r is WeddingPreview => r !== null);
}

// ── Invite code lookup ─────────────────────────────────────────────────────────

export class InviteCodeRateLimitedError extends Error {}
export class InviteCodeTimeoutError extends Error {}

// Bounds worst-case wait well under the callable's 60s server-side timeout —
// belt-and-suspenders against the class of bug fixed in v1.4.5 (rate-limiter
// contention could stall the request near its full timeout). If this ever
// fires it means something is still slow server-side, not that the request
// necessarily failed — surfaced as its own error so the UI can say "try
// again" instead of the misleading "invalid code".
const INVITE_CODE_TIMEOUT_MS = 15000;

export async function validateInviteCode(
  code: string
): Promise<{ weddingId: string; role: UserRole; preview: CodeIndexDoc['preview'] } | false> {
  try {
    const call = httpsCallable<{ code: string }, CodeIndexDoc>(functions, 'validateInviteCode', {
      timeout: INVITE_CODE_TIMEOUT_MS,
    });
    const res = await call({ code });
    return { weddingId: res.data.weddingId, role: res.data.role, preview: res.data.preview };
  } catch (e: unknown) {
    if (e instanceof FunctionsError && e.code === 'functions/resource-exhausted') {
      throw new InviteCodeRateLimitedError(e.message);
    }
    if (e instanceof FunctionsError && e.code === 'functions/deadline-exceeded') {
      throw new InviteCodeTimeoutError(e.message);
    }
    // not-found (invalid code) and any other error → treat as invalid code
    return false;
  }
}

// ── Host elevation ─────────────────────────────────────────────────────────────

// Firestore rules can't validate an invite code, so the client no longer writes
// `role: 'host'` itself — the callable checks the code against weddingsByCode
// with the Admin SDK and sets the role server-side.
export async function claimHostRole(weddingId: string, code: string): Promise<void> {
  const call = httpsCallable<{ weddingId: string; code: string }, { role: 'host' }>(
    functions,
    'claimHostRole',
    { timeout: INVITE_CODE_TIMEOUT_MS }
  );
  try {
    await call({ weddingId, code });
  } catch (e: unknown) {
    if (e instanceof FunctionsError && e.code === 'functions/resource-exhausted') {
      throw new InviteCodeRateLimitedError(e.message);
    }
    throw new Error(
      e instanceof FunctionsError && e.code === 'functions/permission-denied'
        ? 'That host code is not valid for this wedding.'
        : 'Could not grant host access. Please try again.'
    );
  }
}

export async function leaveWedding(uid: string, weddingId: string) {
  await deleteDoc(doc(db, 'weddings', weddingId, 'members', uid));
  await updateDoc(doc(db, 'users', uid), { weddingIds: arrayRemove(weddingId) });
}

// Full account deletion — removes membership from every wedding the account
// belongs to, plus the global profile doc. Used when a user has no other
// wedding to fall back to; otherwise leaveWedding above is the right call.
export async function deleteAccountFully(uid: string, weddingIds: string[]) {
  await Promise.all(weddingIds.map((weddingId) => deleteDoc(doc(db, 'weddings', weddingId, 'members', uid))));
  await deleteDoc(doc(db, 'users', uid));
}
