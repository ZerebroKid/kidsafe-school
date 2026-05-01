import React from 'react';
import {Modal, Pressable, StyleSheet, Text, View} from 'react-native';

import {colors, radius, spacing} from '../../../theme';
import {Illustration} from './Illustration';

interface Props {
  visible: boolean;
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
export function VerificationSheet({visible, onYes, onNo}: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onNo}>
      <View style={styles.scrim}>
        <View style={styles.sheet}>
          <Illustration name="welcome" size={120} />
          <Text style={styles.title}>Did you manage to set the permission?</Text>
          <View style={styles.row}>
            <Pressable
              onPress={onNo}
              style={({pressed}) => [
                styles.btn,
                styles.btnSecondary,
                pressed && {opacity: 0.85},
              ]}>
              <Text style={styles.btnSecondaryLabel}>No, try again</Text>
            </Pressable>
            <Pressable
              onPress={onYes}
              style={({pressed}) => [
                styles.btn,
                styles.btnPrimary,
                pressed && {opacity: 0.9},
              ]}>
              <Text style={styles.btnPrimaryLabel}>Yes</Text>
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
    backgroundColor: colors.surface,
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
