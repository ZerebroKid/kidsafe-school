import React from 'react';
import {Image, StyleSheet, Text, View, ViewStyle} from 'react-native';

import zkidLogo from '../assets/logo/zkid_logo.png';
import {colors, spacing} from '../theme';

interface Props {
  size?: number;
  showLabel?: boolean;
  style?: ViewStyle;
}

export function AppLogo({size = 48, showLabel = false, style}: Props) {
  return (
    <View style={[styles.row, style]}>
      <Image
        source={zkidLogo}
        style={{width: size, height: size, borderRadius: size * 0.22}}
        accessibilityLabel="ZKid logo"
      />
      {showLabel ? <Text style={styles.label}>ZKid</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 3.2,
    color: colors.textMuted,
  },
});
