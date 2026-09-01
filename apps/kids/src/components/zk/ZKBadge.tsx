/**
 * ZKBadge — Pill/chip badge component.
 *
 * Used for:
 *  - Subject filter tabs (All / In progress / Not started / Mastered)
 *  - "Today" badge on chapters/topics
 *  - Status chips on topic sections
 *  - Label overlines (uppercase label variant)
 */

import React from 'react';
import {StyleSheet, Text, View, ViewStyle} from 'react-native';
import {colors, fonts, radius, spacing} from '../../theme';

export type ZKBadgeVariant =
  | 'primary'   // violet fill, white text
  | 'tinted'    // violet-100 fill, violet text
  | 'outline'   // white fill, border
  | 'success'   // green fill, white text
  | 'successTint' // green-100, dark green text
  | 'gold'      // gold fill, dark gold text
  | 'dark'      // ink-900 fill, white text
  | 'label';    // uppercase overline style

interface ZKBadgeProps {
  label: string;
  variant?: ZKBadgeVariant;
  /** Optional leading icon node */
  icon?: React.ReactNode;
  style?: ViewStyle;
}

const VARIANT_STYLES: Record<
  ZKBadgeVariant,
  {bg: string; text: string; border?: string}
> = {
  primary: {bg: colors.primary, text: '#FFFFFF'},
  tinted: {bg: colors.primaryTint, text: colors.primaryDark},
  outline: {bg: '#FFFFFF', text: colors.textMuted, border: colors.border},
  success: {bg: colors.success, text: '#FFFFFF'},
  successTint: {bg: colors.successTint, text: colors.successDark},
  gold: {bg: colors.gold, text: colors.goldTint},
  dark: {bg: colors.bgDark, text: '#FFFFFF'},
  label: {bg: 'transparent', text: colors.primary},
};

export function ZKBadge({label, variant = 'tinted', icon, style}: ZKBadgeProps) {
  const vs = VARIANT_STYLES[variant];
  const isLabel = variant === 'label';

  return (
    <View
      style={[
        styles.badge,
        {backgroundColor: vs.bg},
        vs.border ? {borderWidth: 1.5, borderColor: vs.border} : null,
        isLabel && styles.labelVariant,
        style,
      ]}>
      {icon && <View style={styles.icon}>{icon}</View>}
      <Text
        style={[
          styles.text,
          {color: vs.text},
          isLabel && styles.labelText,
        ]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    height: 26,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: radius.pill,
  },
  text: {
    fontFamily: fonts.bodySemiBold,
    fontWeight: '600',
    fontSize: 11,
    lineHeight: 14,
  },
  icon: {
    marginRight: 5,
  },
  labelVariant: {
    height: 'auto',
    paddingHorizontal: 0,
    backgroundColor: 'transparent',
  },
  labelText: {
    fontFamily: fonts.bodySemiBold,
    fontWeight: '600',
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
