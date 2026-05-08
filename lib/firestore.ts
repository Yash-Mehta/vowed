import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';

export type UserRole = 'guest' | 'host';

export interface UserDoc {
  displayName: string;
  photoURL: string | null;
  howTheyKnow: string;
  role: UserRole;
  fcmToken: string | null;
  createdAt: unknown;
  isSingle?: boolean;
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

export async function createUserIndex(uid: string, weddingId: string) {
  await setDoc(doc(db, 'users', uid), {
    weddingIds: [weddingId],
    createdAt: serverTimestamp(),
  });
}

// ── Invite code lookup ─────────────────────────────────────────────────────────

export async function validateInviteCode(
  code: string
): Promise<{ weddingId: string; role: UserRole; preview: CodeIndexDoc['preview'] } | false> {
  const snap = await getDoc(doc(db, 'weddingsByCode', code));
  if (!snap.exists()) return false;
  const data = snap.data() as CodeIndexDoc;
  return { weddingId: data.weddingId, role: data.role, preview: data.preview };
}

// ── Legacy helpers (used by profile.tsx + manage.tsx avatar/member updates) ───

export async function getUser(uid: string): Promise<UserDoc | null> {
  const idx = await getUserIndex(uid);
  if (!idx?.weddingIds?.length) return null;
  return getMember(idx.weddingIds[0], uid);
}

export async function updateUser(
  uid: string,
  data: Partial<UserDoc>,
  weddingId: string
) {
  await updateMember(weddingId, uid, data);
}

export async function deleteAccount(uid: string, weddingId: string | null) {
  // Delete member doc
  if (weddingId) {
    await deleteDoc(doc(db, 'weddings', weddingId, 'members', uid));
  }
  // Delete user index
  await deleteDoc(doc(db, 'users', uid));
}
