/**
 * ZKCard — Base white card surface for the ZerebroKid design system.
 *
 * Handles the standard white card (border-radius 24, shadow, optional border).
 * All list cards, mission cards, subject cards etc. are built on this.
 */

import React from 'react';
import {Pressable, StyleSheet, View, ViewStyle} from 'react-native';
import {colors, radius, shadows} from '../../theme';

export type ZKCardVariant =
  | 'default'   // white, shadow
  | 'bordered'  // white + violet border + stronger shadow
  | 'tinted'    // violet-100 tinted bg
  | 'dark'      // dark surface
  | 'success'   // green-100 tinted
  | 'gold';     // gold-100 tinted

interface ZKCardProps {
  children: React.ReactNode;
  variant?: ZKCardVariant;
  onPress?: () => void;
  style?: ViewStyle;
  /** If true, renders as a View (non-pressable). Default: true if no onPress. */
  static?: boolean;
  /** Android ripple color override */
  rippleColor?: string;
}

const VARIANT_STYLES: Record<ZKCardVariant, ViewStyle> = {
  default: {
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  bordered: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.primary,
    ...shadows.cardMd,
  },
  tinted: {
    backgroundColor: colors.primaryTint,
  },
  dark: {
    backgroundColor: colors.bgDark,
  },
  success: {
    backgroundColor: colors.successTint,
  },
  gold: {
    backgroundColor: colors.goldTint,
  },
};

export function ZKCard({
  children,
  variant = 'default',
  onPress,
  style,
  rippleColor,
}: ZKCardProps) {
  const cardStyle: ViewStyle = {
    ...styles.card,
    ...VARIANT_STYLES[variant],
  };

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        android_ripple={{color: rippleColor ?? 'rgba(0,0,0,0.04)'}}
        style={({pressed}) => [
          cardStyle,
          pressed && styles.pressed,
          style,
        ]}>
        {children}
      </Pressable>
    );
  }

  return <View style={[cardStyle, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    overflow: 'hidden',
  },
  pressed: {
    opacity: 0.94,
  },
});
