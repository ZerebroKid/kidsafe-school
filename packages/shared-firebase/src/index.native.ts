// React Native entry point — used by apps/guardian (ZConnect) and apps/kids (ZKid).
// Real implementation lands in Phase 1.3.4 (porting v1 @react-native-firebase wrappers).

export const PLATFORM = 'native' as const;

export * from './auth';
export * from './firestore';
