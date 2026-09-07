import { create } from 'zustand';
import { User } from 'firebase/auth';
import { UserDoc, UserRole } from '../lib/firestore';

interface GlobalProfile {
  displayName: string;
  photoURL: string | null;
  phoneNumber: string | null;
}

interface AuthState {
  firebaseUser: User | null;
  userDoc: UserDoc | null;
  // Account-level profile — persists across switchWedding(), unlike userDoc
  // which is fully replaced per wedding. Empty displayName means no global
  // profile has been set yet (brand-new user).
  globalProfile: GlobalProfile | null;
  isLoading: boolean;
  role: UserRole | null;
  pendingRole: UserRole;
  weddingId: string | null;
  pendingWeddingId: string | null;
  // The invite code that produced pendingWeddingId/pendingRole. Held so the
  // join flow can hand it to claimHostRole, which re-validates it server-side.
  pendingCode: string | null;
  userWeddingIds: string[];
  setFirebaseUser: (user: User | null) => void;
  setUserDoc: (doc: UserDoc | null) => void;
  setGlobalProfile: (profile: GlobalProfile | null) => void;
  setLoading: (loading: boolean) => void;
  setPendingRole: (role: UserRole) => void;
  setWeddingId: (id: string | null) => void;
  setPendingWeddingId: (id: string | null) => void;
  setPendingCode: (code: string | null) => void;
  setUserWeddingIds: (ids: string[]) => void;
  switchWedding: (weddingId: string, memberDoc: UserDoc) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  firebaseUser: null,
  userDoc: null,
  globalProfile: null,
  isLoading: true,
  role: null,
  pendingRole: 'guest',
  weddingId: null,
  pendingWeddingId: null,
  pendingCode: null,
  userWeddingIds: [],
  setFirebaseUser: (user) => set({ firebaseUser: user }),
  setUserDoc: (doc) => set({ userDoc: doc, role: doc?.role ?? null }),
  setGlobalProfile: (globalProfile) => set({ globalProfile }),
  setLoading: (isLoading) => set({ isLoading }),
  setPendingRole: (pendingRole) => set({ pendingRole }),
  setWeddingId: (weddingId) => set({ weddingId }),
  setPendingWeddingId: (pendingWeddingId) => set({ pendingWeddingId }),
  setPendingCode: (pendingCode) => set({ pendingCode }),
  setUserWeddingIds: (userWeddingIds) => set({ userWeddingIds }),
  switchWedding: (weddingId, memberDoc) => {
    set({ weddingId, userDoc: memberDoc, role: memberDoc.role });
  },
  clear: () =>
    set({
      firebaseUser: null,
      userDoc: null,
      globalProfile: null,
      role: null,
      pendingRole: 'guest',
      weddingId: null,
      pendingWeddingId: null,
      pendingCode: null,
      userWeddingIds: [],
    }),
}));
