import React, {useState} from 'react';
import {ActivityIndicator, Alert, Pressable, StyleSheet, Text, View} from 'react-native';

import {colors, radius, spacing} from '../../theme';
import {requestPinReset} from '../../firebase/firestore';

interface Props {
  childUid: string;
  childName: string;
}

/**
 * "Reset PIN" tab body. The action is destructive (clears the on-device PIN) so we keep the
 * same two-step confirm + post-success alert flow the inline accent button used.
 *
 * The mechanics live entirely on the child side: `requestPinReset` writes
 * `pinResetRequest.requestedAt` onto the child doc; the child sync engine watches for it,
 * calls `Pin.clearPin()`, then deletes the field so the request is one-shot.
 */
export function PinTab({childUid, childName}: Props) {
  const [resetting, setResetting] = useState(false);

  function confirmResetPin() {
    Alert.alert(
      'Reset parent PIN?',
      `${childName}'s phone will be asked to set a new PIN the next time the app is opened. Use this only if you forgot the PIN.`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Reset PIN',
          style: 'destructive',
          onPress: async () => {
            setResetting(true);
            try {
              await requestPinReset(childUid);
              Alert.alert(
                'PIN reset requested',
                "When the child's phone next syncs, the existing PIN will be cleared and they'll be prompted to set a new one.",
              );
            } catch (e: any) {
              Alert.alert('Could not request reset', e?.message ?? 'Unknown error');
            } finally {
              setResetting(false);
            }
          },
        },
      ],
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Reset child PIN</Text>
        <Text style={styles.subtitle}>
          The parent PIN protects sensitive actions on the child's phone (changing system
          settings, uninstalling KidSafe, etc.). Use this only if you forgot the PIN — your
          child will be prompted to set a new one the next time they open KidSafe.
        </Text>
      </View>

      <Pressable
        onPress={confirmResetPin}
        disabled={resetting}
        style={[styles.resetBtn, resetting && styles.resetBtnDisabled]}>
        {resetting ? (
          <ActivityIndicator color={colors.primaryText} />
        ) : (
          <Text style={styles.resetBtnLabel}>Reset PIN</Text>
        )}
      </Pressable>

      <Text style={styles.footnote}>
        The reset takes effect the next time the child's phone syncs (usually within a few
        seconds while online).
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.warning,
    gap: spacing.xs,
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  resetBtn: {
    backgroundColor: colors.danger,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  resetBtnDisabled: {opacity: 0.6},
  resetBtnLabel: {
    color: colors.primaryText,
    fontSize: 16,
    fontWeight: '700',
  },
  footnote: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
});
