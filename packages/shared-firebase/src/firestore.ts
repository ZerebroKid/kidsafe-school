// Firestore helpers stub — Phase 1.3.4 ports v1 src/firebase/firestore.ts.

export type DocPath = string;

export async function readDoc<T>(_path: DocPath): Promise<T | null> {
  throw new Error('not implemented — wired in Phase 1.3.4');
}

export async function writeDoc<T>(_path: DocPath, _data: T): Promise<void> {
  throw new Error('not implemented — wired in Phase 1.3.4');
}
