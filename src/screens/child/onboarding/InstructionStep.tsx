import React, {useCallback, useEffect, useRef, useState} from 'react';
import {AppState, StyleSheet, Text, View} from 'react-native';

import {colors, radius, spacing} from '../../../theme';
import {Illustration} from './Illustration';
import {VerificationSheet} from './VerificationSheet';
import {WizardStep} from './WizardStep';
import type {InstructionsStep as Step} from './types';

interface Props {
  step: Step;
  totalSteps: number;
  stepIndex: number;
  timeRemaining?: string;
  onComplete: () => void;
}

/**
 * The "Go to settings" workhorse. Shows a numbered bullet list of micro-instructions and a
 * "Go to activation" CTA. After the user returns from the system page we re-check the permission
 * via the step's `check()`. If still false, the verification sheet asks them whether they
 * actually granted it; "Yes" force-advances (useful when our detection lags), "No" reopens the
 * settings deep link.
 */
export function InstructionStep({
  step,
  totalSteps,
  stepIndex,
  timeRemaining,
  onComplete,
}: Props) {
  const [opening, setOpening] = useState(false);
  const [showVerify, setShowVerify] = useState(false);
  // Did the user just come back from a system page? Used to gate the "still not granted" prompt.
  const returningFromSettings = useRef(false);

  const recheck = useCallback(async () => {
    try {
      const ok = await step.check();
      if (ok) {
        onComplete();
        return true;
      }
    } catch {
      // ignore — keep the user on this step
    }
    return false;
  }, [step, onComplete]);

  useEffect(() => {
    // Auto-advance if the permission is already granted from a previous attempt (e.g. the wizard
    // is being resumed from a kill-and-relaunch).
    recheck();
  }, [recheck]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', async state => {
      if (state !== 'active') {return;}
      if (!returningFromSettings.current) {return;}
      returningFromSettings.current = false;
      // Tiny delay — some OEMs (Xiaomi) take a moment to flush the secure-setting write.
      await new Promise(r => setTimeout(r, 400));
      const granted = await recheck();
      if (!granted) {setShowVerify(true);}
    });
    return () => sub.remove();
  }, [recheck]);

  async function handleOpen() {
    setOpening(true);
    try {
      returningFromSettings.current = true;
      await step.openSettings();
    } catch (e) {
      console.warn('openSettings failed', e);
    } finally {
      setOpening(false);
    }
  }

  function handleVerifyYes() {
    setShowVerify(false);
    onComplete();
  }

  function handleVerifyNo() {
    setShowVerify(false);
    handleOpen();
  }

  return (
    <WizardStep
      totalSteps={totalSteps}
      stepIndex={stepIndex}
      timeRemaining={timeRemaining}
      primaryCta={{label: step.ctaLabel, onPress: handleOpen, loading: opening}}>
      <View style={styles.headerBlock}>
        {step.illustration && (
          <Illustration name={step.illustration} size={120} />
        )}
        <Text style={styles.title}>{step.title}</Text>
        <Text style={styles.subtitle}>{step.subtitle}</Text>
      </View>

      <View style={styles.bulletCard}>
        {step.bullets.map((b, i) => (
          <View key={i} style={styles.bulletRow}>
            <View style={styles.bulletIndex}>
              <Text style={styles.bulletIndexLabel}>{i + 1}</Text>
            </View>
            <Text style={styles.bulletIcon}>{b.icon}</Text>
            <Text style={styles.bulletText}>{b.text}</Text>
          </View>
        ))}
      </View>

      <VerificationSheet
        visible={showVerify}
        onYes={handleVerifyYes}
        onNo={handleVerifyNo}
      />
    </WizardStep>
  );
}

const styles = StyleSheet.create({
  headerBlock: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  bulletCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.md,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  bulletIndex: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bulletIndexLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  bulletIcon: {
    fontSize: 22,
    width: 28,
    textAlign: 'center',
  },
  bulletText: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
});
