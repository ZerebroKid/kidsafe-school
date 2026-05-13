import React, {useState} from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {Pin} from '../../../modules/native';
import {colors, radius, spacing} from '../../../theme';

interface Props {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const MAX_LEN = 6;

/**
 * Reusable PIN-confirmation modal. The parent enters their PIN; we verify it via the native
 * `Pin.verifyPin` call (which already enforces salting + lockout backoff) and only then invoke
 * `onConfirm`.
 *
 * Used by [FinalStep] for the "Skip uninstall protection" escape hatch — the child cannot click
 * through it because the entered value is verified against the salted hash stored at PIN setup.
 *
 * `Alert.prompt` with `secure-text` is iOS-only on stock RN, so we own the input UI here.
 */
export function ParentPinPromptModal({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  destructive = false,
  onConfirm,
  onCancel,
}: Props) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function reset() {
    setPin('');
    setError(null);
    setBusy(false);
  }

  async function handleConfirm() {
    if (pin.length < 4) {
      setError('Enter the parent PIN to continue.');
      return;
    }
    setBusy(true);
    try {
      const ok = await Pin.verifyPin(pin).catch(() => false);
      if (!ok) {
        setError('Wrong PIN. Try again.');
        setBusy(false);
        return;
      }
      reset();
      onConfirm();
    } catch {
      setError('Could not verify the PIN. Try again.');
      setBusy(false);
    }
  }

  function handleCancel() {
    reset();
    onCancel();
  }

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={handleCancel}>
      <Pressable style={styles.backdrop} onPress={handleCancel}>
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          <TextInput
            style={styles.input}
            value={pin}
            onChangeText={t => {
              setPin(t.replace(/\D/g, '').slice(0, MAX_LEN));
              setError(null);
            }}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={MAX_LEN}
            autoFocus
            placeholder="Parent PIN"
            placeholderTextColor={colors.textMuted}
            editable={!busy}
          />
          {error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.row}>
            <Pressable
              style={[styles.button, styles.cancel]}
              onPress={handleCancel}
              disabled={busy}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[
                styles.button,
                destructive ? styles.destructive : styles.primary,
                busy && styles.buttonBusy,
              ]}
              onPress={handleConfirm}
              disabled={busy}>
              <Text
                style={
                  destructive ? styles.destructiveText : styles.primaryText
                }>
                {busy ? 'Checking…' : confirmLabel}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  message: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  input: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 6,
    minHeight: 52,
    paddingHorizontal: spacing.md,
    textAlign: 'center',
  },
  error: {
    color: colors.danger,
    fontSize: 13,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  cancel: {
    backgroundColor: colors.surfaceAlt,
  },
  cancelText: {
    color: colors.text,
    fontWeight: '600',
  },
  primary: {
    backgroundColor: colors.primary,
  },
  primaryText: {
    color: colors.primaryText,
    fontWeight: '700',
  },
  destructive: {
    backgroundColor: colors.danger,
  },
  destructiveText: {
    color: colors.text,
    fontWeight: '700',
  },
  buttonBusy: {
    opacity: 0.7,
  },
});
