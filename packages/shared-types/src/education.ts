// Education types — fully defined in Phase 4 (P4.2.1, P4.2.2).
// Stubs here so apps can import @zerebro/shared-types/education from Day 1.

import type { FirestoreTimestampMs } from './firestore';

export interface SchoolDocStub {
  id: string;
  name: string;
  principalUid?: string;
  teacherCode?: string;
  createdAt: FirestoreTimestampMs;
}
