import { create } from 'zustand';
import { User } from 'firebase/auth';
import { UserDoc, UserRole } from '../lib/firestore';

interface AuthState {
  firebaseUser: User | null;
  userDoc: UserDoc | null;
  isLoading: boolean;
  role: UserRole | null;
  pendingRole: UserRole;
  weddingId: string | null;
  pendingWeddingId: string | null;
  userWeddingIds: string[];
  setFirebaseUser: (user: User | null) => void;
  setUserDoc: (doc: UserDoc | null) => void;
  setLoading: (loading: boolean) => void;
  setPendingRole: (role: UserRole) => void;
  setWeddingId: (id: string | null) => void;
  setPendingWeddingId: (id: string | null) => void;
  setUserWeddingIds: (ids: string[]) => void;
  switchWedding: (weddingId: string, memberDoc: UserDoc) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  firebaseUser: null,
  userDoc: null,
  isLoading: true,
  role: null,
  pendingRole: 'guest',
  weddingId: null,
  pendingWeddingId: null,
  userWeddingIds: [],
  setFirebaseUser: (user) => set({ firebaseUser: user }),
  setUserDoc: (doc) => set({ userDoc: doc, role: doc?.role ?? null }),
  setLoading: (isLoading) => set({ isLoading }),
  setPendingRole: (pendingRole) => set({ pendingRole }),
  setWeddingId: (weddingId) => set({ weddingId }),
  setPendingWeddingId: (pendingWeddingId) => set({ pendingWeddingId }),
  setUserWeddingIds: (userWeddingIds) => set({ userWeddingIds }),
  switchWedding: (weddingId, memberDoc) => {
    set({ weddingId, userDoc: memberDoc, role: memberDoc.role });
  },
  clear: () =>
    set({
      firebaseUser: null,
      userDoc: null,
      role: null,
      pendingRole: 'guest',
      weddingId: null,
      pendingWeddingId: null,
      userWeddingIds: [],
    }),
}));
