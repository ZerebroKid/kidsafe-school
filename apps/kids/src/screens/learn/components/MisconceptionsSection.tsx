import React from 'react';
import {StyleSheet, Text, View} from 'react-native';

import type {MisconceptionItem} from '../../../firebase/study';
import {colors, radius, spacing} from '../../../theme';

interface Props {
  items: MisconceptionItem[];
}

export function MisconceptionsSection({items}: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Common Mistakes</Text>
      {items.map((item, i) => (
        <View key={i} style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.labelWrong}>Wrong</Text>
            <Text style={styles.wrongText}>{item.wrong}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.labelCorrect}>Correct</Text>
            <Text style={styles.correctText}>{item.correct}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {gap: spacing.sm},
  heading: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  card: {
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  row: {gap: spacing.xs},
  labelWrong: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.danger,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  labelCorrect: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  wrongText: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 20,
  },
  correctText: {
    fontSize: 13,
    color: colors.text,
    lineHeight: 20,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
});
