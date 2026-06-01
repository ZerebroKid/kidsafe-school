import React from 'react';
import {Modal, Pressable, StyleSheet, Text, View} from 'react-native';

import {colors, radius, spacing} from '../../../theme';
import {Illustration} from './Illustration';

interface Props {
  visible: boolean;
  /**
   * Title shown at the top of the sheet. Defaults to a friendly "did you do it?" line. Steps
   * that already double-checked (re-ran their `check()` after a delay) can pass a stronger
   * message like "We still can't detect the change".
   */
  title?: string;
  /** Optional secondary line. Useful for surfacing what to look for the next time. */
  body?: string;
  yesLabel?: string;
  noLabel?: string;
  onYes: () => void;
  onNo: () => void;
}

/**
 * Bottom sheet shown when the user returns from a system settings page but our `check()` still
 * reports the permission as not granted. They might have actually granted it (and our detection
 * lags behind, e.g. accessibility services on Xiaomi can take ~1s to show up in
 * Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES) — so we ask explicitly instead of forcing them
 * to redo the steps.
 */
export function VerificationSheet({
  visible,
  title = 'Did you manage to set the permission?',
  body,
  yesLabel = 'Yes',
  noLabel = 'No, try again',
  onYes,
  onNo,
}: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onNo}>
      <View style={styles.scrim}>
        <View style={styles.sheet}>
          <Illustration name="welcome" size={120} />
          <Text style={styles.title}>{title}</Text>
          {body && <Text style={styles.body}>{body}</Text>}
          <View style={styles.row}>
            <Pressable
              onPress={onNo}
              style={({pressed}) => [
                styles.btn,
                styles.btnSecondary,
                pressed && {opacity: 0.85},
              ]}>
              <Text style={styles.btnSecondaryLabel}>{noLabel}</Text>
            </Pressable>
            <Pressable
              onPress={onYes}
              style={({pressed}) => [
                styles.btn,
                styles.btnPrimary,
                pressed && {opacity: 0.9},
              ]}>
              <Text style={styles.btnPrimaryLabel}>{yesLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  body: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    paddingHorizontal: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    width: '100%',
  },
  btn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
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
    backgroundColor: colors.surfaceAlt,
  },
  btnSecondaryLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
});
