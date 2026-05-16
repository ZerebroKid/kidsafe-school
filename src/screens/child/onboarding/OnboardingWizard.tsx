import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {ActivityIndicator, StyleSheet, View} from 'react-native';

import {colors} from '../../../theme';
import {detectOem, detectOemFromPlatform} from '../../../utils/oem';
import {useAuthStore} from '../../../state/authStore';
import {FinalStep} from './FinalStep';
import {IllustrationStep} from './IllustrationStep';
import {InstructionStep} from './InstructionStep';
import {PinSetupStep} from './PinSetupStep';
import {ProminentDisclosureStep} from './ProminentDisclosureStep';
import {RuntimePermissionStep} from './RuntimePermissionStep';
import {stepsForOem} from './steps';
import type {Step} from './types';

/**
 * Per-uid storage key. Using a per-uid key means:
 *   - signing in as a different child (e.g. for testing) starts the wizard from step 0
 *   - signing the same child back in resumes wherever they left off
 *   - we never accidentally show step 0 to a user who already finished onboarding
 */
const storageKey = (uid: string | null | undefined) =>
  `kidsafe.onboarding.${uid ?? 'anonymous'}.lastCompletedIndex`;

interface OnboardingWizardProps {
  /**
   * Optional override for the "child" identity the wizard sets up. Defaults to the signed-in
   * Firebase uid (the standard two-device child-on-their-own-phone flow). Shared-phone mode
   * passes `${parentUid}_shared` so the foreground service + tamper events bind to the
   * shared profile rather than the parent's own user doc.
   */
  childUidOverride?: string;
}

/**
 * Wizard controller. Picks the OEM-specific step list, tracks the user's position, persists
 * progress to AsyncStorage so a relaunch resumes mid-flow, and routes each step to the matching
 * component.
 *
 * Auto-skip: if a step's `check()` returns true (e.g. the user has already granted the
 * permission from a previous attempt), the controller silently advances. This is what makes
 * the wizard feel snappy when the user reopens the app after granting half the permissions.
 *
 * NOTE: we do NOT clear AsyncStorage on `Finish`. If `ChildNavigator` doesn't immediately flip
 * to Status (e.g. because a permission was lied through), the user lands back on this screen —
 * we want them to see the FinalStep again (which will show what's missing) instead of being
 * dropped at step 0.
 */
export function OnboardingWizard({childUidOverride}: OnboardingWizardProps = {}) {
  // Optimistic OEM detection: start with whatever Platform.constants knows synchronously, then
  // upgrade to the native module's answer once it resolves. This avoids a "loading…" flash for
  // users on devices the helper recognises immediately.
  const [oem, setOem] = useState(() => detectOemFromPlatform());
  const [hydrated, setHydrated] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const signedInUid = useAuthStore(s => s.firebaseUid);
  const childUid = childUidOverride ?? signedInUid;
  const steps = useMemo<Step[]>(() => stepsForOem(oem), [oem]);

  // -- Boot: detect OEM (real, not just Platform.constants) and load saved progress -----------

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [resolvedOem, savedIndexStr] = await Promise.all([
        detectOem().catch(() => oem),
        AsyncStorage.getItem(storageKey(childUid)),
      ]);
      if (cancelled) {return;}
      setOem(resolvedOem);
      const savedIndex = savedIndexStr ? parseInt(savedIndexStr, 10) : 0;
      // Clamp so a step-list shrink (e.g. switching OEM branches) doesn't crash the wizard.
      const clamped =
        Number.isFinite(savedIndex) && savedIndex >= 0
          ? Math.min(savedIndex, stepsForOem(resolvedOem).length - 1)
          : 0;
      setStepIndex(clamped);
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [childUid]);

  // -- Auto-skip already-granted steps when arriving at a new index ---------------------------

  useEffect(() => {
    if (!hydrated) {return;}
    const step = steps[stepIndex];
    if (!step) {return;}
    if (step.kind === 'illustration' && !step.check) {return;}
    if (step.kind === 'disclosure') {return;} // disclosure must always be shown explicitly
    if (step.kind === 'final') {return;}

    let cancelled = false;
    (async () => {
      const check =
        step.kind === 'illustration'
          ? step.check
          : step.kind === 'instructions' || step.kind === 'runtime' || step.kind === 'pin'
            ? step.check
            : undefined;
      if (!check) {return;}
      try {
        const ok = await check();
        if (!cancelled && ok) {advance();}
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex, hydrated, steps]);

  // -- Advance / jump helpers -----------------------------------------------------------------

  const persistIndex = useCallback(
    async (idx: number) => {
      try {
        await AsyncStorage.setItem(storageKey(childUid), String(idx));
      } catch {
        // best-effort
      }
    },
    [childUid],
  );

  const advance = useCallback(() => {
    setStepIndex(prev => {
      const next = Math.min(prev + 1, steps.length - 1);
      persistIndex(next);
      return next;
    });
  }, [steps.length, persistIndex]);

  /**
   * FinalStep uses this to jump back to a missing-permission step. Falls back to advancing if
   * the id is unknown (e.g. an OEM-specific step that isn't in the current step list).
   */
  const jumpToStepId = useCallback(
    (stepId: string) => {
      const idx = steps.findIndex(s => s.id === stepId);
      if (idx < 0) {return;}
      setStepIndex(idx);
      persistIndex(idx);
    },
    [steps, persistIndex],
  );

  const skipPair = useCallback(
    (pairId: string) => {
      // Find the index of the paired step and skip past it.
      const pairIdx = steps.findIndex(s => s.id === pairId);
      setStepIndex(prev => {
        const next = Math.min(
          Math.max(prev + 1, pairIdx + 1),
          steps.length - 1,
        );
        persistIndex(next);
        return next;
      });
    },
    [steps, persistIndex],
  );

  // -- Render --------------------------------------------------------------------------------

  if (!hydrated) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const step = steps[stepIndex];
  const totalSteps = steps.length;

  // Crude but matches the Kids360 reference: ~20s per remaining step (their average).
  const remainingSec = Math.max(0, (totalSteps - stepIndex - 1) * 20);
  const timeRemaining = formatRemaining(remainingSec);

  switch (step.kind) {
    case 'illustration':
      return (
        <IllustrationStep
          step={step}
          totalSteps={totalSteps}
          stepIndex={stepIndex}
          timeRemaining={timeRemaining}
          onComplete={advance}
        />
      );
    case 'instructions':
      return (
        <InstructionStep
          step={step}
          totalSteps={totalSteps}
          stepIndex={stepIndex}
          timeRemaining={timeRemaining}
          onComplete={advance}
        />
      );
    case 'runtime':
      return (
        <RuntimePermissionStep
          step={step}
          totalSteps={totalSteps}
          stepIndex={stepIndex}
          timeRemaining={timeRemaining}
          onComplete={advance}
        />
      );
    case 'disclosure':
      return (
        <ProminentDisclosureStep
          step={step}
          totalSteps={totalSteps}
          stepIndex={stepIndex}
          timeRemaining={timeRemaining}
          onComplete={agreed => {
            if (agreed) {
              advance();
            } else {
              skipPair(step.pairsWithStepId);
            }
          }}
        />
      );
    case 'pin':
      return (
        <PinSetupStep
          step={step}
          totalSteps={totalSteps}
          stepIndex={stepIndex}
          timeRemaining={timeRemaining}
          onComplete={advance}
        />
      );
    case 'final':
      return (
        <FinalStep
          step={step}
          totalSteps={totalSteps}
          stepIndex={stepIndex}
          childUid={childUid ?? ''}
          jumpToStep={jumpToStepId}
        />
      );
  }
}

function formatRemaining(sec: number): string {
  if (sec === 0) {return '';}
  const mins = Math.floor(sec / 60);
  const rem = sec % 60;
  if (mins === 0) {return `${rem} sec`;}
  if (rem === 0) {return `${mins} min`;}
  return `${mins} min ${rem} sec`;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
