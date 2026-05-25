// Web entry point — used by apps/principal-web and apps/admin-web.
// Real implementation lands in Phase 2.2.1 (firebase/web SDK init).

export const PLATFORM = 'web' as const;

export * from './auth';
export * from './firestore';
