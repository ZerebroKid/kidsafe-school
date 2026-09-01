/**
 * ZKSectionHeader — Section label + title pattern.
 *
 * Renders the consistent:
 *   OVERLINE (violet, uppercase)
 *   Heading (ink-900, bold)
 *
 * Used throughout the app as section dividers and card headers.
 */

import React from 'react';
import {StyleSheet, Text, View, ViewStyle} from 'react-native';
import {colors, fonts, neutral, spacing} from '../../theme';

interface ZKSectionHeaderProps {
  overline?: string;
  title: string;
  style?: ViewStyle;
  /** Show overline in violet (default) or muted */
  overlineVariant?: 'primary' | 'muted';
}

export function ZKSectionHeader({
  overline,
  title,
  style,
  overlineVariant = 'primary',
}: ZKSectionHeaderProps) {
  return (
    <View style={[styles.root, style]}>
      {overline && (
        <Text
          style={[
            styles.overline,
            overlineVariant === 'muted' && styles.overlineMuted,
          ]}>
          {overline.toUpperCase()}
        </Text>
      )}
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: spacing.xs,
  },
  overline: {
    fontFamily: fonts.bodySemiBold,
    fontWeight: '600',
    fontSize: 11,
    letterSpacing: 0.5,
    color: colors.primary,
  },
  overlineMuted: {
    color: neutral.ink500,
  },
  title: {
    fontFamily: fonts.heading,
    fontWeight: '700',
    fontSize: 20,
    lineHeight: 26,
    color: neutral.ink900,
  },
});
