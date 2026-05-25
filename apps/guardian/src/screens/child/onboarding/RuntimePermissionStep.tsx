import React, {useCallback, useEffect, useState} from 'react';
import {AppState, PermissionsAndroid, StyleSheet, Text, View} from 'react-native';

import {ForegroundService, Location} from '../../../modules/native';
import {useAuthStore} from '../../../state/authStore';
import {colors, spacing} from '../../../theme';
import {Illustration} from './Illustration';
import {WizardStep} from './WizardStep';
import type {RuntimeStep as Step} from './types';

interface Props {
  step: Step;
  totalSteps: number;
  stepIndex: number;
  timeRemaining?: string;
  onComplete: () => void;
}

/**
 * Runtime PermissionsAndroid step: notifications, location (foreground/background), physical
 * activity. The user taps "Allow", we fire the system request dialog, and on `AppState`
 * returning to active we re-check via the step's `check()`.
 *
 * If a permission is "never ask again", the dialog won't appear; we fall through to the
 * `check()` which will report false, and the user can re-tap "Allow" to manually grant from
 * settings (the system handles that route automatically since Android 11).
 */
export function RuntimePermissionStep({
  step,
  totalSteps,
  stepIndex,
  timeRemaining,
  onComplete,
}: Props) {
  const [requesting, setRequesting] = useState(false);

  // The signed-in child uid. Used to start the foreground service the moment foreground
  // (or background) location is granted — see the §2 comment in `handleAllow`.
  const childUid = useAuthStore(s => s.firebaseUid);

  const recheck = useCallback(async () => {
    try {
      const ok = await step.check();
      if (ok) {
        onComplete();
        return true;
      }
    } catch {
      // ignore
    }
    return false;
  }, [step, onComplete]);

  useEffect(() => {
    recheck();
  }, [recheck]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') {recheck();}
    });
    return () => sub.remove();
  }, [recheck]);

  async function handleAllow() {
    setRequesting(true);
    try {
      if (step.permission == null) {
        // No PermissionsAndroid call needed (e.g. notifications on Android <13). Just check.
        await recheck();
        return;
      }
      if (Array.isArray(step.permission)) {
        await PermissionsAndroid.requestMultiple(step.permission);
      } else {
        await PermissionsAndroid.request(step.permission);
      }
      const granted = await recheck();
      // §2 from the reliable-location plan: start the foreground service the MOMENT either
      // foreground OR background location is granted. The FG service hosts the native
      // `LocationWriter`, which is the only thing OEMs (especially ColorOS / Realme) reliably
      // keep alive long enough to actually deliver fused-location callbacks once the kid
      // backgrounds the wizard.
      //
      // Without this, `Location.startWatching()` registers a callback against the bare app
      // process, and on aggressive OEMs that callback gets suspended within ~30s of the
      // wizard leaving the foreground — even though the user already granted location. The
      // FG service's `foregroundServiceType="location"` is the documented Android contract
      // that keeps location callbacks alive.
      //
      // `ForegroundService.start` is idempotent (`KidSafeForegroundService` uses
      // `START_STICKY` and `LocationWriter.start` self-checks `watching` flag).
      // We try BOTH location steps so a kid who completes background after foreground still
      // re-triggers the writer attach in case the service was killed between steps.
      if (
        granted &&
        (step.id === 'locationForeground' || step.id === 'locationBackground')
      ) {
        try {
          await Location.startWatching();
          console.log('[KidSafe][Location] post-grant startWatching ok (onboarding)', {
            stepId: step.id,
          });
        } catch (e) {
          console.warn('[KidSafe][Location] post-grant startWatching failed', e);
        }
        if (childUid) {
          try {
            await ForegroundService.start(childUid);
            console.log(
              '[KidSafe][Location] post-grant ForegroundService.start ok (onboarding)',
              {stepId: step.id, childUid},
            );
          } catch (e) {
            // Non-fatal: `FinalStep` will retry the start before flipping to Status, and
            // the engine's AppState recovery hook re-tries on every foreground.
            console.warn(
              '[KidSafe][Location] post-grant ForegroundService.start failed (will retry at FinalStep)',
              e,
            );
          }
        } else {
          console.warn(
            '[KidSafe][Location] post-grant ForegroundService.start skipped — no signed-in uid yet',
          );
        }
      }
    } catch (e) {
      console.warn('requestPermission failed', e);
    } finally {
      setRequesting(false);
    }
  }

  return (
    <WizardStep
      totalSteps={totalSteps}
      stepIndex={stepIndex}
      timeRemaining={timeRemaining}
      primaryCta={{label: 'Allow', onPress: handleAllow, loading: requesting}}>
      <View style={styles.center}>
        <Illustration name={step.illustration} size={180} />
        <Text style={styles.title}>{step.title}</Text>
        <Text style={styles.subtitle}>{step.subtitle}</Text>
        {step.rationale && (
          <View style={styles.rationale}>
            <Text style={styles.rationaleText}>{step.rationale}</Text>
          </View>
        )}
      </View>
    </WizardStep>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  rationale: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: 12,
    marginTop: spacing.md,
  },
  rationaleText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
});
