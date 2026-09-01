/**
 * ZKComingSoonRibbon — "Coming soon" ribbon overlay.
 *
 * Renders the left-edge pill ribbon from the design:
 *   position: absolute; right: 0; top: 12; pill; bg: #EDE6FF or #6D3BFF (dark)
 *
 * Used on Live classes, AI Exam Predictor, Focus Mode, and any unbuilt feature.
 */

import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {brand, fonts, neutral, radius} from '../../theme';

interface ZKComingSoonRibbonProps {
  /** 'light' (violet-100 bg, violet text) | 'dark' (violet fill, white text) */
  variant?: 'light' | 'dark';
  /** Override the default "Coming soon" label */
  label?: string;
  /** Top offset from parent top edge (default 12) */
  top?: number;
}

export function ZKComingSoonRibbon({
  variant = 'light',
  label = 'Coming soon',
  top = 12,
}: ZKComingSoonRibbonProps) {
  const isDark = variant === 'dark';
  return (
    <View
      style={[
        styles.ribbon,
        {top},
        isDark ? styles.dark : styles.light,
      ]}
      pointerEvents="none">
      <Text style={[styles.text, isDark ? styles.textDark : styles.textLight]}>
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  ribbon: {
    position: 'absolute',
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    height: 22,
    paddingHorizontal: 10,
    borderTopLeftRadius: radius.pill,
    borderBottomLeftRadius: radius.pill,
  },
  light: {
    backgroundColor: brand.violet100,
  },
  dark: {
    backgroundColor: brand.violet600,
  },
  text: {
    fontFamily: fonts.bodySemiBold,
    fontWeight: '600',
    fontSize: 9,
    letterSpacing: 0.5,
  },
  textLight: {
    color: brand.violet700,
  },
  textDark: {
    color: neutral.surface,
  },
});
