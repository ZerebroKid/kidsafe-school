import React, {useCallback, useEffect, useRef, useState} from 'react';
import {AppState, StyleSheet, Text, View} from 'react-native';

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
      try {
        await step.onCtaAction();
      } finally {
        setBusy(false);
      }
      // When the step has both onCtaAction and a check, we wait for AppState to flip back to
      // active before advancing — otherwise we'd race past the system grant dialog.
      if (step.check) {return;}
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
        onYes={() => {
          setShowVerify(false);
          onComplete();
        }}
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
