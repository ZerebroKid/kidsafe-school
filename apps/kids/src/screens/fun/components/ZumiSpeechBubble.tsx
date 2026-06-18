/**
 * Shows what Zumi is currently saying, as readable on-screen text alongside
 * the spoken audio (helps early readers + noisy environments). Styled as a
 * clean light card to match the rest of the app.
 */

import React from 'react';
import {StyleSheet, Text, View} from 'react-native';

import {colors, radius, spacing} from '../../../theme';

export function ZumiSpeechBubble({text}: {text: string}) {
  if (!text) return null;
  return (
    <View style={styles.bubble}>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    maxWidth: '92%',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: {width: 0, height: 4},
    elevation: 2,
  },
  text: {
    color: colors.text,
    fontSize: 18,
    lineHeight: 26,
    textAlign: 'center',
    fontWeight: '600',
  },
});
