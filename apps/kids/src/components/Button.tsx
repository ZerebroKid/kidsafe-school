import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';

import {colors, radius, spacing} from '../theme';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface Props {
  title: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

export function Button({title, onPress, variant = 'primary', disabled, loading, style}: Props) {
  const bg =
    variant === 'primary'
      ? colors.primary
      : variant === 'secondary'
      ? colors.surfaceAlt
      : variant === 'danger'
      ? colors.danger
      : 'transparent';
  const fg =
    variant === 'primary'
      ? colors.primaryText
      : variant === 'ghost'
      ? colors.primary
      : colors.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({pressed}) => [
        styles.base,
        {backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.85 : 1},
        variant === 'ghost' && styles.ghost,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View>
          <Text style={[styles.label, {color: fg}]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghost: {
    borderWidth: 1,
    borderColor: colors.primary,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
});
