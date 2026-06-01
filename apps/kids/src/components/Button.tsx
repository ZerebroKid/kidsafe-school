import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
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

/**
 * Button uses a STATIC style array (not the function form `style={({pressed}) => [...]}`)
 * because some style-pipeline middlewares (NativeWind's CSS-Interop being the prime
 * suspect we just hit) intercept the function variant and drop the explicit
 * `backgroundColor`, which made the button render invisible (dark text on dark bg).
 *
 * Pressed feedback now comes from Android's native ripple + the opacity styles set
 * on disabled / loading state, which is plenty for the UX we need.
 */
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
  const isInactive = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isInactive}
      android_ripple={{color: 'rgba(0,0,0,0.08)'}}
      style={[
        styles.base,
        {backgroundColor: bg},
        variant === 'ghost' && styles.ghost,
        isInactive && styles.inactive,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={[styles.label, {color: fg}]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: '100%',
    minHeight: 48,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghost: {
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: 'transparent',
  },
  inactive: {
    opacity: 0.4,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
});

