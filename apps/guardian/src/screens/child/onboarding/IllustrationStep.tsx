import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Alert, AppState, StyleSheet, Text, View} from 'react-native';

import {Supervision} from '../../../modules/native';
import {colors, spacing} from '../../../theme';
import {Illustration} from './Illustration';
import {VerificationSheet} from './VerificationSheet';
import {WizardStep} from './WizardStep';
import type {IllustrationStep as Step} from './types';

interface Props {
  step: Step;
  totalSteps: number;
  stepIndex: number;
  timeRemaining?: string;
  onComplete: () => void;
}

/**
 * "Marketing-style" intro screen — large mascot illustration, friendly title, one-line subtitle,
 * a single "Set up" / "Let's do this" CTA. Used for the welcome screen, the device-admin intro
 * and any other step that doesn't need explicit numbered instructions.
 *
 * If the step provides a `check` callback (e.g. device-admin activation), the screen behaves
 * like an InstructionStep: polls when the app returns to the foreground, auto-advances when
 * the permission becomes granted, and falls back to the verification sheet if not.
 */
export function IllustrationStep({
  step,
  totalSteps,
  stepIndex,
  timeRemaining,
  onComplete,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [showVerify, setShowVerify] = useState(false);
  const returningFromAction = useRef(false);

  const recheck = useCallback(async () => {
    if (!step.check) {return false;}
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
    if (!step.check) {return;}
    const sub = AppState.addEventListener('change', async state => {
      if (state !== 'active') {return;}
      if (!returningFromAction.current) {return;}
      returningFromAction.current = false;
      await new Promise(r => setTimeout(r, 400));
      const granted = await recheck();
      if (!granted) {setShowVerify(true);}
    });
    return () => sub.remove();
  }, [recheck, step.check]);

  async function handleCta() {
    if (step.onCtaAction) {
      setBusy(true);
      returningFromAction.current = true;
      // Arm the supervision window before the CTA fires (e.g. device-admin enable). Otherwise
      // AccessibilityService sees the system "Activate device admin?" page, which mentions our
      // app label, and would gate it behind the parent PIN — exactly during onboarding.
      try {
        await Supervision.arm(3 * 60_000);
      } catch {
        // Best-effort — don't fail onboarding if the native module isn't linked.
      }
      try {
        await step.onCtaAction();
      } catch (e) {
        // Some OEMs refuse certain activation intents (e.g. device admin on Pixel-flavoured
        // Android Go) — surface that to the user rather than swallowing it silently.
        returningFromAction.current = false;
        Alert.alert(
          'Could not open the system page',
          (e as Error)?.message ||
            'This feature might not be supported on your device. You can skip this step and continue.',
          [
            {text: 'Skip', onPress: onComplete},
            {text: 'OK'},
          ],
        );
        return;
      } finally {
        setBusy(false);
      }
      // When the step has both onCtaAction and a check, we wait for AppState to flip back to
      // active before advancing — otherwise we'd race past the system grant dialog.
      if (step.check) {return;}
    }
    onComplete();
  }

  async function handleVerifyYes() {
    setShowVerify(false);
    if (step.check) {
      // Honest re-check after a delay, same logic as InstructionStep — caters for OEMs that
      // flush the secure setting asynchronously.
      await new Promise(r => setTimeout(r, 600));
      try {
        const ok = await step.check();
        if (ok) {
          onComplete();
          return;
        }
      } catch {
        // fall through
      }
    }
    onComplete();
  }

  return (
    <WizardStep
      totalSteps={totalSteps}
      stepIndex={stepIndex}
      timeRemaining={timeRemaining}
      primaryCta={{label: step.ctaLabel, onPress: handleCta, loading: busy}}>
      <View style={styles.center}>
        <Illustration name={step.illustration} size={200} />
        <Text style={styles.title}>{step.title}</Text>
        <Text style={styles.subtitle}>{step.subtitle}</Text>
      </View>
      <VerificationSheet
        visible={showVerify}
        onYes={handleVerifyYes}
        onNo={() => {
          setShowVerify(false);
          handleCta();
        }}
      />
    </WizardStep>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.xl,
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
});
