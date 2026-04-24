import {create} from 'zustand';

import type {UserDoc} from '../firebase/types';

interface AuthState {
  firebaseUid: string | null;
  firebaseEmail: string | null;
  emailVerified: boolean;
  bootstrapped: boolean;
  userDoc: UserDoc | null;
  setFirebaseUser: (user: {uid: string; email: string | null; emailVerified: boolean} | null) => void;
  setUserDoc: (doc: UserDoc | null) => void;
  setBootstrapped: (b: boolean) => void;
}

export const useAuthStore = create<AuthState>(set => ({
  firebaseUid: null,
  firebaseEmail: null,
  emailVerified: false,
  bootstrapped: false,
  userDoc: null,
  setFirebaseUser: user =>
    set({
      firebaseUid: user?.uid ?? null,
      firebaseEmail: user?.email ?? null,
      emailVerified: user?.emailVerified ?? false,
    }),
  setUserDoc: doc => set({userDoc: doc}),
  setBootstrapped: bootstrapped => set({bootstrapped}),
}));
