import { create } from 'zustand';
import { User } from 'firebase/auth';
import { UserDoc, UserRole } from '../lib/firestore';

interface AuthState {
  firebaseUser: User | null;
  userDoc: UserDoc | null;
  isLoading: boolean;
  isProfileComplete: boolean;
  role: UserRole | null;
  setFirebaseUser: (user: User | null) => void;
  setUserDoc: (doc: UserDoc | null) => void;
  setLoading: (loading: boolean) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  firebaseUser: null,
  userDoc: null,
  isLoading: true,
  isProfileComplete: false,
  role: null,
  setFirebaseUser: (user) => set({ firebaseUser: user }),
  setUserDoc: (doc) =>
    set({
      userDoc: doc,
      role: doc?.role ?? null,
      isProfileComplete: !!doc?.displayName && !!doc?.howTheyKnow,
    }),
  setLoading: (isLoading) => set({ isLoading }),
  clear: () =>
    set({ firebaseUser: null, userDoc: null, role: null, isProfileComplete: false }),
}));
