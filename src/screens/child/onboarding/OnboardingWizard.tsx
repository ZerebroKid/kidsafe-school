import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {ActivityIndicator, StyleSheet, View} from 'react-native';

import {colors} from '../../../theme';
import {detectOem, detectOemFromPlatform} from '../../../utils/oem';
import {useAuthStore} from '../../../state/authStore';
import {FinalStep} from './FinalStep';
import {IllustrationStep} from './IllustrationStep';
import {InstructionStep} from './InstructionStep';
import {ProminentDisclosureStep} from './ProminentDisclosureStep';
import {RuntimePermissionStep} from './RuntimePermissionStep';
import {stepsForOem} from './steps';
import type {Step} from './types';

const STORAGE_KEY = 'kidsafe.onboarding.lastCompletedIndex';

/**
 * Wizard controller. Picks the OEM-specific step list, tracks the user's position, persists
 * progress to AsyncStorage so a relaunch resumes mid-flow, and routes each step to the matching
 * component.
 *
 * Auto-skip: if a step's `check()` returns true (e.g. the user has already granted the
 * permission from a previous attempt), the controller silently advances. This is what makes
 * the wizard feel snappy when the user reopens the app after granting half the permissions.
 */
export function OnboardingWizard() {
  // Optimistic OEM detection: start with whatever Platform.constants knows synchronously, then
  // upgrade to the native module's answer once it resolves. This avoids a "loading…" flash for
  // users on devices the helper recognises immediately.
  const [oem, setOem] = useState(() => detectOemFromPlatform());
  const [hydrated, setHydrated] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const childUid = useAuthStore(s => s.firebaseUid);
  const steps = useMemo<Step[]>(() => stepsForOem(oem), [oem]);

  // -- Boot: detect OEM (real, not just Platform.constants) and load saved progress -----------

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [resolvedOem, savedIndexStr] = await Promise.all([
        detectOem().catch(() => oem),
        AsyncStorage.getItem(STORAGE_KEY),
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
  }, []);

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
          : step.kind === 'instructions' || step.kind === 'runtime'
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

  // -- Advance / skip helpers -----------------------------------------------------------------

  const persistIndex = useCallback(async (idx: number) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, String(idx));
    } catch {
      // best-effort
    }
  }, []);

  const advance = useCallback(() => {
    setStepIndex(prev => {
      const next = Math.min(prev + 1, steps.length - 1);
      persistIndex(next);
      return next;
    });
  }, [steps.length, persistIndex]);

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
    case 'final':
      return (
        <FinalStep
          step={step}
          totalSteps={totalSteps}
          stepIndex={stepIndex}
          childUid={childUid ?? ''}
          onFinish={async () => {
            // Wipe persistence so a re-onboard (after sign out / sign back in) starts fresh.
            try {
              await AsyncStorage.removeItem(STORAGE_KEY);
            } catch {
              // best-effort
            }
            // ChildNavigator watches `ForegroundService.isRunning` and flips to StatusScreen
            // automatically — nothing else to do here.
          }}
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
