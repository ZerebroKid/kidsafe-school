/**
 * ZKButton — Primary CTA button for the ZerebroKid Class 6–12 design system.
 *
 * Variants:
 *  - primary: violet gradient, white text (default)
 *  - secondary: white surface, violet border + text
 *  - ghost: transparent, violet text
 *  - danger: red gradient
 *
 * Features: loading spinner, icon slot (left/right), press scale animation,
 * disabled state.
 */

import React, {useRef} from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import Svg, {Defs, LinearGradient, Rect, Stop} from 'react-native-svg';
import {brand, colors, fonts, radius, shadows, spacing} from '../../theme';

export type ZKButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ZKButtonSize = 'sm' | 'md' | 'lg';

interface ZKButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ZKButtonVariant;
  size?: ZKButtonSize;
  loading?: boolean;
  disabled?: boolean;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  style?: ViewStyle;
  /** Full-width (default: true) */
  fullWidth?: boolean;
}

const SIZE_HEIGHT: Record<ZKButtonSize, number> = {
  sm: 40,
  md: 48,
  lg: 56,
};

const SIZE_FONT: Record<ZKButtonSize, number> = {
  sm: 13,
  md: 14,
  lg: 15,
};

export function ZKButton({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  loading = false,
  disabled = false,
  iconLeft,
  iconRight,
  style,
  fullWidth = true,
}: ZKButtonProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const isDisabled = disabled || loading;

  const handlePressIn = () => {
    Animated.timing(scale, {
      toValue: 0.97,
      duration: 80,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      friction: 5,
      useNativeDriver: true,
    }).start();
  };

  const height = SIZE_HEIGHT[size];
  const fontSize = SIZE_FONT[size];

  const containerStyle: ViewStyle = {
    height,
    borderRadius: radius.pill,
    overflow: 'hidden',
    ...(fullWidth ? {} : {alignSelf: 'flex-start' as const}),
  };

  return (
    <Animated.View
      style={[containerStyle, {transform: [{scale}]}, isDisabled && styles.disabled, style]}>
      <Pressable
        onPress={isDisabled ? undefined : onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        android_ripple={variant === 'primary' ? null : {color: 'rgba(109,59,255,0.12)'}}
        style={[styles.pressable, variantStyles[variant], {height}]}>
        {variant === 'primary' && !isDisabled && (
          <GradientBg />
        )}
        {loading ? (
          <ActivityIndicator
            size="small"
            color={variant === 'primary' ? '#FFFFFF' : colors.primary}
          />
        ) : (
          <>
            {iconLeft && <View style={styles.iconLeft}>{iconLeft}</View>}
            <Text
              style={[
                styles.label,
                {fontSize},
                variantTextStyles[variant],
              ]}>
              {label}
            </Text>
            {iconRight && <View style={styles.iconRight}>{iconRight}</View>}
          </>
        )}
      </Pressable>
    </Animated.View>
  );
}

function GradientBg() {
  return (
    <Svg style={StyleSheet.absoluteFill}>
      <Defs>
        <LinearGradient id="btnGrad" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={brand.violet500} />
          <Stop offset="1" stopColor={brand.violet700} />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#btnGrad)" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  pressable: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  label: {
    fontFamily: fonts.bodySemiBold,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.5,
  },
  iconLeft: {
    marginRight: spacing.sm,
  },
  iconRight: {
    marginLeft: spacing.sm,
  },
});

const variantStyles: Record<ZKButtonVariant, ViewStyle> = {
  primary: {
    ...shadows.cta,
  },
  secondary: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  danger: {
    backgroundColor: colors.danger,
  },
};

const variantTextStyles: Record<ZKButtonVariant, {color: string}> = {
  primary: {color: '#FFFFFF'},
  secondary: {color: colors.primary},
  ghost: {color: colors.primary},
  danger: {color: '#FFFFFF'},
};
