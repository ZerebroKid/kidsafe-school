import React, {useState} from 'react';
import {Alert, StyleSheet, Text, View} from 'react-native';

import {colors, radius, spacing} from '../../../theme';
import {ForegroundService} from '../../../modules/native';
import {Illustration} from './Illustration';
import {WizardStep} from './WizardStep';
import type {FinalStep as Step} from './types';

interface Props {
  step: Step;
  totalSteps: number;
  stepIndex: number;
  childUid: string;
  onFinish: () => void;
}

/**
 * "All set!" celebration screen. Tapping the primary CTA starts the foreground service —
 * which is also one of the gates `ChildNavigator` watches, so the navigator will swap us out
 * for the StatusScreen once the service is up.
 *
 * The "blocking test" originally planned for this step was deliberately reduced to a textual
 * tip: a self-contained test would have to mutate the local blocklist (racing the parent's
 * Firestore writes) and then unblock the user from the blocked-app overlay before they could
 * tap "Finish". Easier to ask the parent to block any app from their dashboard and confirm
 * the overlay appears on the child phone.
 */
export function FinalStep({
  step,
  totalSteps,
  stepIndex,
  childUid,
  onFinish,
}: Props) {
  const [busy, setBusy] = useState(false);

  async function handleFinish() {
    setBusy(true);
    try {
      await ForegroundService.start(childUid);
      onFinish();
    } catch (e) {
      Alert.alert('Could not start monitoring', (e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <WizardStep
      totalSteps={totalSteps}
      stepIndex={stepIndex}
      primaryCta={{label: step.ctaLabel, onPress: handleFinish, loading: busy}}>
      <View style={styles.center}>
        <Illustration name="celebrate" size={220} />
        <Text style={styles.title}>{step.title}</Text>
        <Text style={styles.subtitle}>{step.subtitle}</Text>

        <View style={styles.tipCard}>
          <Text style={styles.tipTitle}>How to test that blocking works</Text>
          <Text style={styles.tipText}>
            From your parent's KidSafe app, tap any app on this device's app list and toggle
            "Blocked". Then open that app on this phone — the KidSafe block screen should appear.
          </Text>
        </View>
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
    fontSize: 26,
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
  tipCard: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.md,
    marginTop: spacing.lg,
    width: '100%',
  },
  tipTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  tipText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
});
