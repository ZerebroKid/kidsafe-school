import React, {useState} from 'react';
import {Alert, StyleSheet, Text, TextInput, View} from 'react-native';

import {Pin} from '../../../modules/native';
import {colors, radius, spacing} from '../../../theme';
import {Illustration} from './Illustration';
import {WizardStep} from './WizardStep';
import type {PinStep as Step} from './types';

interface Props {
  step: Step;
  totalSteps: number;
  stepIndex: number;
  timeRemaining?: string;
  onComplete: () => void;
}

const MIN_LEN = 4;
const MAX_LEN = 6;

/**
 * Two-stage PIN entry: first the parent picks a PIN, then they confirm it. We never store the
 * raw value in JS state longer than necessary — the native module hashes it as soon as it's set.
 *
 * The step is intended to be done on the *child device*, with the parent physically present:
 * any later attempt to disable accessibility / uninstall / change OEM autostart for KidSafe will
 * pop a system overlay asking for this PIN.
 */
export function PinSetupStep({
  step,
  totalSteps,
  stepIndex,
  timeRemaining,
  onComplete,
}: Props) {
  const [phase, setPhase] = useState<'enter' | 'confirm'>('enter');
  const [first, setFirst] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function isValid(pin: string): boolean {
    return pin.length >= MIN_LEN && pin.length <= MAX_LEN && /^\d+$/.test(pin);
  }

  async function handlePrimary() {
    setError(null);
    if (phase === 'enter') {
      if (!isValid(first)) {
        setError(`PIN must be ${MIN_LEN}-${MAX_LEN} digits.`);
        return;
      }
      setPhase('confirm');
      return;
    }

    if (confirm !== first) {
      setError("PINs don't match. Try again.");
      return;
    }
    setSaving(true);
    try {
      await Pin.setPin(first);
      onComplete();
    } catch (e: any) {
      Alert.alert('Could not save PIN', e?.message ?? 'Unknown error');
    } finally {
      setSaving(false);
    }
  }

  function handleSecondary() {
    if (phase === 'confirm') {
      setPhase('enter');
      setConfirm('');
      setError(null);
      return;
    }
    setFirst('');
    setError(null);
  }

  const primaryLabel =
    phase === 'enter' ? 'Continue' : saving ? 'Saving…' : 'Set PIN';
  const value = phase === 'enter' ? first : confirm;
  const setter = phase === 'enter' ? setFirst : setConfirm;

  return (
    <WizardStep
      totalSteps={totalSteps}
      stepIndex={stepIndex}
      timeRemaining={timeRemaining}
      primaryCta={{
        label: primaryLabel,
        onPress: handlePrimary,
        loading: saving,
        disabled: !isValid(value),
      }}
      secondaryCta={{
        label: phase === 'enter' ? 'Clear' : 'Back',
        onPress: handleSecondary,
        disabled: saving,
      }}>
      <View style={styles.headerBlock}>
        <Illustration name={step.illustration} size={120} />
        <Text style={styles.title}>{step.title}</Text>
        <Text style={styles.subtitle}>
          {phase === 'enter'
            ? step.subtitle
            : 'Re-enter the PIN to confirm. The child should not see this number.'}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>
          {phase === 'enter' ? 'New parent PIN' : 'Confirm PIN'}
        </Text>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={t => {
            setter(t.replace(/\D/g, '').slice(0, MAX_LEN));
            setError(null);
          }}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={MAX_LEN}
          autoFocus
          placeholder={`${MIN_LEN}-${MAX_LEN} digits`}
          placeholderTextColor={colors.textMuted}
        />
        {error && <Text style={styles.errorText}>{error}</Text>}
        <Text style={styles.helper}>
          The child will be asked for this PIN if they try to uninstall KidSafe,
          turn off the accessibility service, or change autostart settings.
        </Text>
      </View>
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
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  label: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  input: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    color: colors.text,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: 8,
    minHeight: 56,
    paddingHorizontal: spacing.md,
    textAlign: 'center',
  },
  errorText: {
    color: colors.warning,
    fontSize: 13,
    marginTop: 4,
  },
  helper: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
});
