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

export type UserRole = 'guest' | 'host';

export interface UserDoc {
  displayName: string;
  photoURL: string | null;
  howTheyKnow: string;
  role: UserRole;
  fcmToken: string | null;
  createdAt: unknown;
  isSingle?: boolean;
  // Notification preferences — absent means enabled; announcements are always on
  notifyPosts?: boolean;
  notifyComments?: boolean;
}

export interface UserIndexDoc {
  weddingIds: string[];
  createdAt: unknown;
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
  await updateDoc(doc(db, 'weddings', weddingId, 'members', uid), data as any);
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

export async function validateInviteCode(
  code: string
): Promise<{ weddingId: string; role: UserRole; preview: CodeIndexDoc['preview'] } | false> {
  try {
    const call = httpsCallable<{ code: string }, CodeIndexDoc>(functions, 'validateInviteCode');
    const res = await call({ code });
    return { weddingId: res.data.weddingId, role: res.data.role, preview: res.data.preview };
  } catch (e: unknown) {
    if (e instanceof FunctionsError && e.code === 'functions/resource-exhausted') {
      throw new InviteCodeRateLimitedError(e.message);
    }
    // not-found (invalid code) and any other error → treat as invalid code
    return false;
  }
}

export async function leaveWedding(uid: string, weddingId: string) {
  await deleteDoc(doc(db, 'weddings', weddingId, 'members', uid));
  await updateDoc(doc(db, 'users', uid), { weddingIds: arrayRemove(weddingId) });
}

export async function deleteAccount(uid: string, weddingId: string | null) {
  if (weddingId) {
    await deleteDoc(doc(db, 'weddings', weddingId, 'members', uid));
    await updateDoc(doc(db, 'users', uid), { weddingIds: arrayRemove(weddingId) });
  } else {
    await deleteDoc(doc(db, 'users', uid));
  }
}
