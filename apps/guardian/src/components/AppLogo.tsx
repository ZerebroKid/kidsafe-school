import React from 'react';
import {Image, StyleSheet, Text, View, ViewStyle} from 'react-native';

import zconnectLogo from '../assets/logo/zconnect_logo.png';
import {colors, spacing} from '../theme';

interface Props {
  size?: number;
  showLabel?: boolean;
  style?: ViewStyle;
}

export function AppLogo({size = 36, showLabel = false, style}: Props) {
  return (
    <View style={[styles.row, style]}>
      <Image
        source={zconnectLogo}
        style={{width: size, height: size, borderRadius: size * 0.22}}
        accessibilityLabel="ZConnect logo"
      />
      {showLabel ? <Text style={styles.label}>ZConnect</Text> : null}
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
