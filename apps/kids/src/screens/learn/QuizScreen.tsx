import React, {useCallback, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import {callFn} from '@zerebro/shared-firebase';
import type {
  SubmitQuizAttemptInput,
  SubmitQuizAttemptOutput,
} from '@zerebro/shared-types';

import {Button} from '../../components/Button';
import {useTopicContent} from '../../firebase/study';
import {colors, radius, spacing} from '../../theme';
import type {StudyStackParamList} from '../../navigation/types';

type Props = NativeStackScreenProps<StudyStackParamList, 'Quiz'>;

/**
 * P4.9.1 -- one-question-at-a-time quiz.
 *
 * Loads the quiz from the topic doc (live), presents one MCQ per screen with
 * Back/Next, tracks the child's selections locally, and on the final question
 * calls the `submitQuizAttempt` callable. The SERVER grades (the client never
 * computes the score), then we replace the route with the result screen so the
 * back button doesn't return into a finished quiz.
 */
export function QuizScreen({route, navigation}: Props) {
  const {assignmentId, curriculumId, chapterId, topicId, topicName} =
    route.params;
  const {data: topic, loading, error} = useTopicContent(
    curriculumId,
    chapterId,
    topicId,
  );

  const quiz = useMemo(() => topic?.quiz ?? [], [topic]);

  const [current, setCurrent] = useState(0);
  // questionId -> selectedIndex
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const total = quiz.length;
  const isLast = current === total - 1;
  const question = quiz[current];
  const selectedIndex = question ? answers[question.questionId] : undefined;
  const answeredCount = Object.keys(answers).length;

  const select = useCallback(
    (questionId: string, index: number) => {
      setAnswers(prev => ({...prev, [questionId]: index}));
    },
    [],
  );

  const submit = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload: SubmitQuizAttemptInput = {
        assignmentId,
        answers: quiz.map(q => ({
          questionId: q.questionId,
          selectedIndex:
            typeof answers[q.questionId] === 'number'
              ? answers[q.questionId]
              : -1,
        })),
      };
      const result = await callFn<
        SubmitQuizAttemptInput,
        SubmitQuizAttemptOutput
      >('submitQuizAttempt', payload);
      navigation.replace('QuizResult', {
        result,
        topicName,
        assignmentId,
        curriculumId,
        chapterId,
        topicId,
      });
    } catch (err) {
      setSubmitError(
        (err as {message?: string} | null)?.message ??
          'Could not submit your quiz. Check your connection and try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }, [
    submitting,
    assignmentId,
    quiz,
    answers,
    navigation,
    topicName,
    curriculumId,
    chapterId,
    topicId,
  ]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.mutedText}>Loading quiz…</Text>
      </View>
    );
  }

  if (error || !topic) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emoji}>⚠️</Text>
        <Text style={styles.errorTitle}>Could not load quiz</Text>
        <Text style={styles.mutedText}>{error ?? 'Topic not found.'}</Text>
        <Button
          title="Go back"
          variant="secondary"
          onPress={() => navigation.goBack()}
          style={{marginTop: spacing.md}}
        />
      </View>
    );
  }

  if (total === 0 || !question) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emoji}>📭</Text>
        <Text style={styles.errorTitle}>No quiz for this topic</Text>
        <Text style={styles.mutedText}>
          There aren&apos;t any questions here yet. Try again after the next
          update.
        </Text>
        <Button
          title="Go back"
          variant="secondary"
          onPress={() => navigation.goBack()}
          style={{marginTop: spacing.md}}
        />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* Progress */}
      <View style={styles.progressHeader}>
        <Text style={styles.progressText}>
          Question {current + 1} of {total}
        </Text>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {width: `${((current + 1) / total) * 100}%`},
            ]}
          />
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled">
        <Text style={styles.question}>{question.question}</Text>

        <View style={styles.options}>
          {question.options.map((opt, idx) => {
            const isSelected = selectedIndex === idx;
            return (
              <Pressable
                key={idx}
                onPress={() => select(question.questionId, idx)}
                android_ripple={{color: 'rgba(0,0,0,0.06)'}}
                style={[styles.option, isSelected && styles.optionSelected]}>
                <View
                  style={[
                    styles.radio,
                    isSelected && styles.radioSelected,
                  ]}>
                  {isSelected ? <View style={styles.radioDot} /> : null}
                </View>
                <Text
                  style={[
                    styles.optionText,
                    isSelected && styles.optionTextSelected,
                  ]}>
                  {opt}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {submitError ? (
          <Text style={styles.submitError}>{submitError}</Text>
        ) : null}
      </ScrollView>

      {/* Footer nav */}
      <View style={styles.footer}>
        <View style={styles.footerRow}>
          {current > 0 ? (
            <View style={styles.footerBtn}>
              <Button
                title="Back"
                variant="secondary"
                onPress={() => setCurrent(c => Math.max(0, c - 1))}
                disabled={submitting}
              />
            </View>
          ) : null}
          <View style={styles.footerBtn}>
            {isLast ? (
              <Button
                title={
                  answeredCount < total ? 'Answer all to submit' : 'Submit quiz'
                }
                onPress={submit}
                loading={submitting}
                disabled={answeredCount < total}
              />
            ) : (
              <Button
                title="Next"
                onPress={() => setCurrent(c => Math.min(total - 1, c + 1))}
                disabled={selectedIndex === undefined}
              />
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: colors.bg},
  centered: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  progressHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  progressText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  progressTrack: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  scroll: {flex: 1},
  content: {padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xl},
  question: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    lineHeight: 28,
  },
  options: {gap: spacing.sm},
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  optionSelected: {
    borderColor: colors.text,
    backgroundColor: colors.surfaceAlt,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {borderColor: colors.text},
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.text,
  },
  optionText: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    lineHeight: 21,
  },
  optionTextSelected: {fontWeight: '600'},
  submitError: {
    fontSize: 13,
    color: colors.danger,
    textAlign: 'center',
  },
  footer: {
    padding: spacing.md,
    paddingBottom: spacing.lg,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerRow: {flexDirection: 'row', gap: spacing.md},
  footerBtn: {flex: 1},
  emoji: {fontSize: 40},
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  mutedText: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
