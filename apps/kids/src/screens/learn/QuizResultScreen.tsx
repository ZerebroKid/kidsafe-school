import React, {useMemo} from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {Button} from '../../components/Button';
import {useTopicContent, type QuizQuestion} from '../../firebase/study';
import {colors, radius, spacing} from '../../theme';
import type {StudyStackParamList} from '../../navigation/types';

type Props = NativeStackScreenProps<StudyStackParamList, 'QuizResult'>;

/**
 * P4.9.3 -- quiz result + reward CTA.
 *
 * Renders entirely from the server's graded payload (no trust in the client
 * score). We additionally load the topic content to label each question with
 * its text + option text for a readable breakdown; if it isn't loaded we fall
 * back to "Question N" + option letters.
 *
 * Pass -> "See your reward" routes to RewardUnlock (P4.10.3).
 * Fail -> encouragement + "Try again" re-enters the quiz (retakes allowed).
 */
export function QuizResultScreen({route, navigation}: Props) {
  const {result, topicName, assignmentId, curriculumId, chapterId, topicId} =
    route.params;
  const {data: topic} = useTopicContent(curriculumId, chapterId, topicId);

  const questionById = useMemo(() => {
    const map = new Map<string, QuizQuestion>();
    for (const q of topic?.quiz ?? []) map.set(q.questionId, q);
    return map;
  }, [topic]);

  const optionLabel = (i: number) => String.fromCharCode(65 + i); // A, B, C...

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}>
        {/* Score hero */}
        <View
          style={[
            styles.hero,
            result.passed ? styles.heroPass : styles.heroFail,
          ]}>
          <Text style={styles.heroEmoji}>{result.passed ? '🎉' : '💪'}</Text>
          <Text style={styles.heroTitle}>
            {result.passed ? 'You passed!' : 'Keep going!'}
          </Text>
          <Text style={styles.heroScore}>
            {result.score} / {result.total} correct
          </Text>
          <Text style={styles.heroPct}>{result.percentage}%</Text>
          <Text style={styles.heroSub}>{topicName}</Text>
        </View>

        {/* Breakdown */}
        <Text style={styles.sectionTitle}>Review your answers</Text>
        {result.results.map((r, idx) => {
          const q = questionById.get(r.questionId);
          const questionText = q?.question ?? `Question ${idx + 1}`;
          const yourText =
            r.selectedIndex >= 0
              ? q?.options?.[r.selectedIndex] ?? optionLabel(r.selectedIndex)
              : 'No answer';
          const correctText =
            q?.options?.[r.correctIndex] ?? optionLabel(r.correctIndex);
          return (
            <View key={r.questionId} style={styles.qCard}>
              <View style={styles.qHeader}>
                <Text style={styles.qIndex}>Q{idx + 1}</Text>
                <Text
                  style={[
                    styles.qBadge,
                    r.isCorrect ? styles.qBadgeOk : styles.qBadgeBad,
                  ]}>
                  {r.isCorrect ? 'Correct' : 'Wrong'}
                </Text>
              </View>
              <Text style={styles.qText}>{questionText}</Text>
              <Text style={styles.answerRow}>
                <Text style={styles.answerLabel}>Your answer: </Text>
                <Text
                  style={
                    r.isCorrect ? styles.answerOk : styles.answerBad
                  }>
                  {yourText}
                </Text>
              </Text>
              {!r.isCorrect ? (
                <Text style={styles.answerRow}>
                  <Text style={styles.answerLabel}>Correct answer: </Text>
                  <Text style={styles.answerOk}>{correctText}</Text>
                </Text>
              ) : null}
              {r.explanation ? (
                <Text style={styles.explanation}>{r.explanation}</Text>
              ) : null}
            </View>
          );
        })}

        <View style={{height: 90}} />
      </ScrollView>

      {/* Sticky CTA */}
      <View style={styles.ctaContainer}>
        {result.passed ? (
          <Button
            title="See your reward 🎁"
            onPress={() =>
              navigation.replace('RewardUnlock', {
                attemptId: result.attemptId,
                topicName,
              })
            }
          />
        ) : (
          <View style={styles.ctaRow}>
            <View style={styles.ctaBtn}>
              <Button
                title="Back to topic"
                variant="secondary"
                onPress={() => navigation.popToTop()}
              />
            </View>
            <View style={styles.ctaBtn}>
              <Button
                title="Try again"
                onPress={() =>
                  navigation.replace('Quiz', {
                    assignmentId,
                    curriculumId,
                    chapterId,
                    topicId,
                    topicName,
                  })
                }
              />
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: colors.bg},
  scroll: {flex: 1},
  content: {padding: spacing.lg, gap: spacing.md},
  hero: {
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  heroPass: {
    backgroundColor: 'rgba(74, 222, 128, 0.12)',
    borderColor: 'rgba(74, 222, 128, 0.4)',
  },
  heroFail: {
    backgroundColor: 'rgba(250, 204, 21, 0.10)',
    borderColor: 'rgba(250, 204, 21, 0.35)',
  },
  heroEmoji: {fontSize: 48},
  heroTitle: {fontSize: 22, fontWeight: '800', color: colors.text},
  heroScore: {fontSize: 15, color: colors.text},
  heroPct: {fontSize: 32, fontWeight: '800', color: colors.primary},
  heroSub: {fontSize: 13, color: colors.textMuted, textAlign: 'center'},
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.sm,
  },
  qCard: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  qHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  qIndex: {fontSize: 13, fontWeight: '700', color: colors.textMuted},
  qBadge: {
    fontSize: 11,
    fontWeight: '700',
    overflow: 'hidden',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  qBadgeOk: {
    color: colors.success,
    backgroundColor: 'rgba(74, 222, 128, 0.15)',
  },
  qBadgeBad: {
    color: colors.danger,
    backgroundColor: 'rgba(248, 113, 113, 0.15)',
  },
  qText: {fontSize: 15, color: colors.text, lineHeight: 21},
  answerRow: {fontSize: 14, lineHeight: 20},
  answerLabel: {color: colors.textMuted},
  answerOk: {color: colors.success, fontWeight: '600'},
  answerBad: {color: colors.danger, fontWeight: '600'},
  explanation: {
    fontSize: 13,
    color: colors.textMuted,
    fontStyle: 'italic',
    lineHeight: 19,
    marginTop: spacing.xs,
  },
  ctaContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.md,
    paddingBottom: spacing.lg,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  ctaRow: {flexDirection: 'row', gap: spacing.md},
  ctaBtn: {flex: 1},
});
