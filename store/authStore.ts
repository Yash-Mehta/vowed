import { create } from 'zustand';
import { User } from 'firebase/auth';
import { UserDoc, UserRole } from '../lib/firestore';

interface AuthState {
  firebaseUser: User | null;
  userDoc: UserDoc | null;
  isLoading: boolean;
  isProfileComplete: boolean;
  role: UserRole | null;
  pendingRole: UserRole;
  setFirebaseUser: (user: User | null) => void;
  setUserDoc: (doc: UserDoc | null) => void;
  setLoading: (loading: boolean) => void;
  setPendingRole: (role: UserRole) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  firebaseUser: null,
  userDoc: null,
  isLoading: true,
  isProfileComplete: false,
  role: null,
  pendingRole: 'guest',
  setFirebaseUser: (user) => set({ firebaseUser: user }),
  setUserDoc: (doc) =>
    set({
      userDoc: doc,
      role: doc?.role ?? null,
      isProfileComplete: !!doc?.displayName && !!doc?.howTheyKnow,
    }),
  setLoading: (isLoading) => set({ isLoading }),
  setPendingRole: (pendingRole) => set({ pendingRole }),
  clear: () =>
    set({ firebaseUser: null, userDoc: null, role: null, isProfileComplete: false, pendingRole: 'guest' }),
}));
