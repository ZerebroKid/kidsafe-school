import React from 'react';
import {StyleSheet, Text, View} from 'react-native';

import {colors, spacing} from '../../../theme';
import {WizardStep} from './WizardStep';
import type {DisclosureStep as Step} from './types';

interface Props {
  step: Step;
  totalSteps: number;
  stepIndex: number;
  timeRemaining?: string;
  /** Called with `agreed=true` if the user taps the Agree CTA, `false` if they tap Skip. */
  onComplete: (agreed: boolean) => void;
}

/**
 * Play Store-mandated disclosure for sensitive permissions like the Accessibility API. The user
 * can tap "Agree" to continue (next step is the actual permission grant) or "Skip" — which the
 * wizard controller uses to also skip the *paired* step (defined via `pairsWithStepId`), since
 * disclosure-then-grant is meant to be atomic.
 */
export function ProminentDisclosureStep({
  step,
  totalSteps,
  stepIndex,
  timeRemaining,
  onComplete,
}: Props) {
  return (
    <WizardStep
      totalSteps={totalSteps}
      stepIndex={stepIndex}
      timeRemaining={timeRemaining}
      primaryCta={{label: step.agreeLabel, onPress: () => onComplete(true)}}
      secondaryCta={{label: 'Skip for now', onPress: () => onComplete(false)}}>
      <Text style={styles.title}>{step.title}</Text>
      {step.subtitle ? <Text style={styles.subtitle}>{step.subtitle}</Text> : null}
      <View style={styles.bodyCard}>
        {step.body.map((para, i) => (
          <Text key={i} style={styles.bodyText}>
            {para}
          </Text>
        ))}
      </View>
    </WizardStep>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
    paddingTop: spacing.md,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  bodyCard: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: 12,
    gap: spacing.md,
    marginTop: spacing.md,
  },
  bodyText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
});
