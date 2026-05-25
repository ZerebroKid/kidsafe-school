// Firestore document types shared by all Zerebro apps + Cloud Functions.
// Real types land in Phase 1.3.3 (migrating from v1 src/firebase/types.ts)
// and Phase 3.2.1 (adding roles[]).

export type Role = 'admin' | 'principal' | 'teacher' | 'parent' | 'child';

export type FirestoreTimestampMs = number;

export interface UserDocStub {
  uid: string;
  phone?: string;
  email?: string;
  roles: Role[];
  primaryRole: Role;
  displayName?: string;
  createdAt: FirestoreTimestampMs;
}
