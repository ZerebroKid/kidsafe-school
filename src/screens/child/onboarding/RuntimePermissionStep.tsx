import React, {useCallback, useEffect, useState} from 'react';
import {AppState, PermissionsAndroid, StyleSheet, Text, View} from 'react-native';

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
 * Runtime PermissionsAndroid step: notifications, location (foreground/background), contacts,
 * physical activity. The user taps "Allow", we fire the system request dialog, and on
 * `AppState` returning to active we re-check via the step's `check()`.
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
      await recheck();
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
