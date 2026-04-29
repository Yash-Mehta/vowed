import { collection, doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

export type UserRole = 'guest' | 'host';

export interface UserDoc {
  displayName: string;
  photoURL: string | null;
  howTheyKnow: string;
  role: UserRole;
  fcmToken: string | null;
  createdAt: unknown;
}

export const usersCol = collection(db, 'users');
export const postsCol = collection(db, 'posts');
export const scheduleCol = collection(db, 'schedule');

export async function getUser(uid: string): Promise<UserDoc | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? (snap.data() as UserDoc) : null;
}

export async function createUser(uid: string, data: Omit<UserDoc, 'createdAt' | 'fcmToken'>) {
  await setDoc(doc(db, 'users', uid), {
    ...data,
    fcmToken: null,
    createdAt: serverTimestamp(),
  });
}

export async function updateUser(uid: string, data: Partial<UserDoc>) {
  await updateDoc(doc(db, 'users', uid), data);
}

export async function validateInviteCode(code: string): Promise<'guest' | 'host' | false> {
  const [guestSnap, hostSnap] = await Promise.all([
    getDoc(doc(db, 'config', 'inviteCode')),
    getDoc(doc(db, 'config', 'hostInviteCode')),
  ]);
  if (guestSnap.exists() && guestSnap.data().code === code) return 'guest';
  if (hostSnap.exists() && hostSnap.data().code === code) return 'host';
  return false;
}
