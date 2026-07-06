/**
 * Shows what Zumi is currently saying, as readable on-screen text alongside
 * the spoken audio (helps early readers + noisy environments). A white
 * rounded "speech bubble" card that pops on the purple fun-mode gradient.
 */

import React from 'react';
import {StyleSheet, Text, View} from 'react-native';

import {spacing} from '../../../theme';

export function ZumiSpeechBubble({text}: {text: string}) {
  if (!text) return null;
  return (
    <View style={styles.bubble}>
      <View style={styles.tail} />
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    backgroundColor: '#ffffff',
    borderRadius: 28,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    maxWidth: '92%',
    shadowColor: '#4c1d95',
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: {width: 0, height: 6},
    elevation: 6,
  },
  tail: {
    position: 'absolute',
    top: -8,
    alignSelf: 'center',
    width: 20,
    height: 20,
    backgroundColor: '#ffffff',
    borderRadius: 4,
    transform: [{rotate: '45deg'}],
  },
  text: {
    color: '#312e81',
    fontSize: 18,
    lineHeight: 27,
    textAlign: 'center',
    fontWeight: '700',
  },
});
