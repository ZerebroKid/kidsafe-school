import React, {useCallback, useState} from 'react';
import {
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';

import type {WorkedProblem} from '../../../firebase/study';
import {colors, radius, spacing} from '../../../theme';

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface Props {
  items: WorkedProblem[];
}

export function WorkedProblemsSection({items}: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Practice Problems</Text>
      {items.map((item, i) => (
        <ProblemCard key={item.problemId} item={item} index={i} />
      ))}
    </View>
  );
}

function ProblemCard({item, index}: {item: WorkedProblem; index: number}) {
  const [expanded, setExpanded] = useState(false);

  const toggle = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(prev => !prev);
  }, []);

  return (
    <Pressable
      onPress={toggle}
      style={styles.card}
      android_ripple={{color: 'rgba(0,0,0,0.04)'}}>
      <View style={styles.questionRow}>
        <Text style={styles.problemNumber}>P{index + 1}</Text>
        <Text style={styles.questionText}>{item.question}</Text>
        <Text style={styles.chevron}>{expanded ? '▲' : '▼'}</Text>
      </View>
      {expanded ? (
        <View style={styles.details}>
          {item.conceptsUsed && item.conceptsUsed.length > 0 ? (
            <View style={styles.block}>
              <Text style={styles.blockLabel}>Concepts</Text>
              {item.conceptsUsed.map((concept, i) => (
                <Text key={i} style={styles.conceptText}>
                  • {concept}
                </Text>
              ))}
            </View>
          ) : null}
          <View style={styles.block}>
            <Text style={styles.blockLabel}>Solution</Text>
            {item.steps.map((step, i) => (
              <Text key={i} style={styles.stepText}>
                {i + 1}. {step}
              </Text>
            ))}
          </View>
          <View style={styles.answerBlock}>
            <Text style={styles.answerLabel}>Answer</Text>
            <Text style={styles.answerText}>{item.answer}</Text>
          </View>
          {item.commonMistake ? (
            <View style={styles.mistakeBlock}>
              <Text style={styles.mistakeLabel}>Common mistake</Text>
              <Text style={styles.mistakeText}>{item.commonMistake}</Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </Pressable>
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
  },
  questionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  problemNumber: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    marginTop: 2,
  },
  questionText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    lineHeight: 20,
  },
  chevron: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 4,
  },
  details: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  block: {gap: spacing.xs},
  blockLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  conceptText: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 20,
  },
  stepText: {
    fontSize: 13,
    color: colors.text,
    lineHeight: 20,
  },
  answerBlock: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  answerLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  answerText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    lineHeight: 20,
  },
  mistakeBlock: {
    gap: spacing.xs,
  },
  mistakeLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.danger,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  mistakeText: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 20,
  },
});
