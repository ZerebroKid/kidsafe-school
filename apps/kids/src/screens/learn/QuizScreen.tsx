import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {Button} from '../../components/Button';
import {colors, radius, spacing} from '../../theme';
import type {StudyStackParamList} from '../../navigation/types';

type Props = NativeStackScreenProps<StudyStackParamList, 'Quiz'>;

/**
 * P4.9 stub -- placeholder quiz screen. The real quiz UI (one-question-at-a-time
 * + submitQuizAttempt callable) ships in Group P4.9. This stub exists so the
 * TopicScreen "Start Quiz" CTA navigates to a valid route end-to-end.
 */
export function QuizScreen({navigation}: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.emoji}>📝</Text>
        <Text style={styles.title}>Quiz coming soon</Text>
        <Text style={styles.body}>
          The quiz for this topic is being prepared. Check back after the next
          app update!
        </Text>
      </View>
      <Button
        title="Go back"
        variant="secondary"
        onPress={() => navigation.goBack()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: spacing.lg,
    justifyContent: 'center',
    gap: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
  },
  emoji: {fontSize: 48},
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  body: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
});
