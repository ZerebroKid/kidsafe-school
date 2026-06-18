/**
 * Four-dot quiz progress + running score for the spoken quiz stage.
 */

import React from 'react';
import {StyleSheet, Text, View} from 'react-native';

export function QuizProgressBar({
  current,
  total,
  score,
}: {
  current: number;
  total: number;
  score: number;
}) {
  if (total <= 0) return null;
  const dots = Array.from({length: total});
  return (
    <View style={styles.wrap}>
      <View style={styles.dots}>
        {dots.map((_, i) => (
          <View
            key={i}
            style={[styles.dot, i < current ? styles.dotDone : null]}
          />
        ))}
      </View>
      <Text style={styles.score}>{score} points</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {alignItems: 'center', gap: 8},
  dots: {flexDirection: 'row', gap: 10},
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  dotDone: {backgroundColor: '#fbbf24'},
  score: {color: '#fde68a', fontSize: 14, fontWeight: '700'},
});
