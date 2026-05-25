import React, {ReactNode} from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {colors, radius, spacing} from '../../../theme';

interface Cta {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary';
}

interface Props {
  /** Total number of steps in the wizard. */
  totalSteps: number;
  /** 0-indexed position of the current step. */
  stepIndex: number;
  /** Friendly remaining-time label like "3 min" or "40 sec". */
  timeRemaining?: string;
  primaryCta: Cta;
  secondaryCta?: Cta;
  children: ReactNode;
}

/**
 * The shared chrome for every wizard step: a segmented progress bar at the top, an estimated
 * "time remaining" label on the right, scrollable content area, and a fixed-bottom CTA stack.
 *
 * The visual reference is the Kids360 / Alli360 onboarding flow — green-filled segments for
 * completed steps, the surfaceAlt color for upcoming ones, and a single chunky bottom button.
 */
export function WizardStep({
  totalSteps,
  stepIndex,
  timeRemaining,
  primaryCta,
  secondaryCta,
  children,
}: Props) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.header}>
        <ProgressBar total={totalSteps} index={stepIndex} />
        {timeRemaining && (
          <Text style={styles.timeRemaining}>{timeRemaining}</Text>
        )}
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>

      <View style={styles.footer}>
        {secondaryCta && (
          <Pressable
            onPress={secondaryCta.onPress}
            disabled={secondaryCta.disabled || secondaryCta.loading}
            style={({pressed}) => [
              styles.btn,
              styles.btnSecondary,
              pressed && {opacity: 0.85},
              secondaryCta.disabled && {opacity: 0.5},
            ]}>
            {secondaryCta.loading ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <Text style={styles.btnSecondaryLabel}>{secondaryCta.label}</Text>
            )}
          </Pressable>
        )}
        <Pressable
          onPress={primaryCta.onPress}
          disabled={primaryCta.disabled || primaryCta.loading}
          style={({pressed}) => [
            styles.btn,
            styles.btnPrimary,
            pressed && {opacity: 0.9},
            (primaryCta.disabled || primaryCta.loading) && {opacity: 0.5},
          ]}>
          {primaryCta.loading ? (
            <ActivityIndicator color={colors.primaryText} />
          ) : (
            <Text style={styles.btnPrimaryLabel}>{primaryCta.label}</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function ProgressBar({total, index}: {total: number; index: number}) {
  // Segments are rendered as flex children with a small gap. Completed = success green; current =
  // primary blue; upcoming = surfaceAlt.
  return (
    <View style={progressStyles.bar}>
      {Array.from({length: total}, (_, i) => {
        const state =
          i < index ? 'done' : i === index ? 'current' : 'upcoming';
        return <View key={i} style={[progressStyles.seg, progressStyles[state]]} />;
      })}
    </View>
  );
}

const progressStyles = StyleSheet.create({
  bar: {
    flex: 1,
    flexDirection: 'row',
    gap: 4,
    height: 6,
  },
  seg: {
    flex: 1,
    height: 6,
    borderRadius: 3,
  },
  done: {backgroundColor: colors.success},
  current: {backgroundColor: colors.primary},
  upcoming: {backgroundColor: colors.surfaceAlt},
});

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  timeRemaining: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    minWidth: 60,
    textAlign: 'right',
  },
  body: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.sm,
    backgroundColor: colors.bg,
  },
  btn: {
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  btnPrimary: {
    backgroundColor: colors.primary,
  },
  btnPrimaryLabel: {
    color: colors.primaryText,
    fontSize: 16,
    fontWeight: '700',
  },
  btnSecondary: {
    backgroundColor: 'transparent',
  },
  btnSecondaryLabel: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
});
