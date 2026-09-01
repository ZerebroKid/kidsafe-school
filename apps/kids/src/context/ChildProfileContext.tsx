/**
 * ChildProfileContext -- single source of truth for the two pieces of child
 * profile the Zumi "Fun" feature needs everywhere: the child's display name
 * and their class grade.
 *
 * Why a context (vs reading hooks ad hoc): the bottom-tab label
 * (`MainTabNavigator`) and the topic-tap routing (`StudyMissionScreen`) BOTH
 * need the grade, and we want one Firestore subscription, not several. The
 * provider is mounted once for the signed-in child.
 *
 * `childName` comes from `users/{uid}.displayName` (already loaded into the
 * auth store at sign-in). `childGrade` is read live from the class doc via
 * `useChildGrade`. When the grade is unknown (loading, no class, or read
 * error) we DELIBERATELY fall back to a non-Fun experience so older kids and
 * un-onboarded kids always see the normal Study flow -- the feature only
 * "opts in" once we positively know grade <= 6.
 */

import auth from '@react-native-firebase/auth';
import React, {createContext, useContext, useEffect, useMemo} from 'react';
import {MMKV} from 'react-native-mmkv';

import {useAuthStore} from '../state/authStore';
import {useChildClassId, useChildGrade} from '../firebase/study';

const profileStorage = new MMKV({id: 'kidsafe.profile_cache'});

function getCachedGrade(uid: string | null): number | null {
  if (!uid) return null;
  const val = profileStorage.getNumber(`grade_${uid}`);
  return typeof val === 'number' ? val : null;
}

function setCachedGrade(uid: string | null, grade: number | null) {
  if (!uid) return;
  if (typeof grade === 'number') {
    profileStorage.set(`grade_${uid}`, grade);
  }
}

/** Highest grade that gets the Zumi voice "Fun" experience (inclusive). */
export const ZUMI_MAX_GRADE = 6;

/**
 * True for children in grade <= 6, INCLUDING pre-primary classes represented
 * with a 0 or negative grade value. Unknown grade (`null`) is intentionally
 * NOT Fun mode.
 */
export function isZumiGrade(grade: number | null | undefined): boolean {
  return typeof grade === 'number' && grade <= ZUMI_MAX_GRADE;
}

export interface ChildProfile {
  /** Child's display name, '' if not yet known. */
  childName: string;
  /** Class grade, or null when unknown. */
  childGrade: number | null;
  /** True only when we positively know the child is grade <= 6. */
  isFunMode: boolean;
  /** True while the grade is still resolving and not yet cached. */
  loading: boolean;
}

const ChildProfileCtx = createContext<ChildProfile>({
  childName: '',
  childGrade: null,
  isFunMode: false,
  loading: true,
});

export function ChildProfileProvider({children}: {children: React.ReactNode}) {
  const uid = useAuthStore(s => s.firebaseUid);
  const displayName = useAuthStore(s => s.userDoc?.displayName);

  const classState = useChildClassId(uid);
  const gradeState = useChildGrade(classState.data);

  useEffect(() => {
    if (uid && typeof gradeState.data === 'number') {
      setCachedGrade(uid, gradeState.data);
    }
  }, [uid, gradeState.data]);

  const value = useMemo<ChildProfile>(() => {
    const cachedGrade = getCachedGrade(uid);
    const effectiveGrade = gradeState.data ?? cachedGrade;
    let name = (displayName ?? '').trim();
    if (!name) {
      const fbName = auth().currentUser?.displayName;
      if (typeof fbName === 'string' && fbName.trim()) {
        name = fbName.trim().split(/\s+/)[0];
      }
    }
    const isLoading = (classState.loading || gradeState.loading) && effectiveGrade === null;
    return {
      childName: name,
      childGrade: effectiveGrade,
      isFunMode: isZumiGrade(effectiveGrade),
      loading: isLoading,
    };
  }, [uid, displayName, gradeState.data, classState.loading, gradeState.loading]);

  return (
    <ChildProfileCtx.Provider value={value}>
      {children}
    </ChildProfileCtx.Provider>
  );
}

export function useChildProfile(): ChildProfile {
  return useContext(ChildProfileCtx);
}
