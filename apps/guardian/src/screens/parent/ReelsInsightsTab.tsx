/**
 * ReelsInsightsTab — parent-facing view of the child's reel watch data.
 *
 * Layout (matching the reference mockup):
 *   1. Hero banner — dark card with child name + topic in bold, playful subtitle
 *   2. Section header — "Ask them these N questions tonight" + subtitle
 *   3. Numbered question cards — one per question, with a number circle
 *   4. Footer tagline — warm closing line
 */

import React, {useMemo} from 'react';
import {ActivityIndicator, StyleSheet, Text, View} from 'react-native';

import {colors, radius, spacing} from '../../theme';
import {formatDateKey} from '@zerebro/shared-firebase/firestore';
import {
  useChildReelInsights,
  useReelTopics,
} from '../../firebase/reelInsights';
import type {ReelTopicInsight} from '@zerebro/shared-types';

interface Props {
  childUid: string;
  childName: string;
}

function formatWatchTime(ms: number): string {
  if (!ms || ms < 1000) return '0s';
  const totalSec = Math.round(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min === 0) return `${sec}s`;
  if (sec === 0) return `${min}m`;
  return `${min}m ${sec}s`;
}

export function ReelsInsightsTab({childUid, childName}: Props) {
  const insightsState = useChildReelInsights(childUid);
  const topicsState = useReelTopics();

  const todayKey = formatDateKey(new Date());
  const todayDoc = useMemo(
    () => insightsState.data?.find(d => d.date === todayKey) ?? null,
    [insightsState.data, todayKey],
  );

  const topicRows = useMemo(() => {
    if (!todayDoc?.perTopic) return [];
    return Object.entries(todayDoc.perTopic)
      .map(([tag, insight]) => ({tag, ...(insight as ReelTopicInsight)}))
      .sort((a, b) => b.watchedMs - a.watchedMs);
  }, [todayDoc]);

  const questionsForToday = useMemo(() => {
    if (!topicsState.data || topicRows.length === 0) return [];
    const result: {topicName: string; questions: string[]}[] = [];
    for (const row of topicRows) {
      const topicDoc = topicsState.data[row.tag];
      if (topicDoc?.parentQuestions?.length) {
        result.push({
          topicName: topicDoc.name,
          questions: topicDoc.parentQuestions,
        });
      }
    }
    return result;
  }, [topicRows, topicsState.data]);

  const primaryTopic = topicRows[0] ?? null;
  const primaryQuestions = questionsForToday[0] ?? null;
  const displayName = childName || 'Your child';

  if (insightsState.loading || topicsState.loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!insightsState.data || insightsState.data.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No reel data yet</Text>
          <Text style={styles.emptyBody}>
            Your child hasn't watched any educational reels yet. Once they do,
            you'll see how much time they spent on each topic and get questions
            to discuss with them.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Section A — Hero banner */}
      <View style={styles.heroBanner}>
        <Text style={styles.heroTitle}>
          {displayName} completed today's lesson on{' '}
          <Text style={styles.heroTopicName}>
            {primaryTopic?.name ?? 'reels'}
          </Text>
        </Text>
        <Text style={styles.heroSubtitle}>
          ...and they don't even know it
        </Text>
        <Text style={styles.heroWatchTime}>
          Watched {formatWatchTime(todayDoc?.totalWatchedMs ?? 0)}
        </Text>
      </View>

      {/* Section B — Questions header */}
      {primaryQuestions && (
        <View style={styles.questionsHeader}>
          <Text style={styles.questionsTitle}>
            Ask them these {primaryQuestions.questions.length} questions tonight
          </Text>
          <Text style={styles.questionsSubtitle}>
            A 2-minute chat at dinner tells you if they truly get it.
          </Text>
        </View>
      )}

      {/* Section C — Numbered question cards */}
      {primaryQuestions ? (
        <View style={styles.questionList}>
          {primaryQuestions.questions.map((q, i) => (
            <View key={i} style={styles.questionCard}>
              <View style={styles.numberCircle}>
                <Text style={styles.numberText}>{i + 1}</Text>
              </View>
              <Text style={styles.questionText}>{q}</Text>
            </View>
          ))}
        </View>
      ) : topicRows.length > 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No questions for today's topics</Text>
          <Text style={styles.emptyBody}>
            Your child watched some reels, but no discussion questions are
            available for those topics yet.
          </Text>
        </View>
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No reels watched today</Text>
          <Text style={styles.emptyBody}>
            Check back later once your child watches some reels.
          </Text>
        </View>
      )}

      {/* Section D — Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerHeart}>&#x2764;</Text>
        <Text style={styles.footerText}>
          Learning becomes a warm family moment.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    gap: spacing.md,
  },
  center: {
    padding: spacing.xl,
    alignItems: 'center',
  },

  // Section A — Hero banner
  heroBanner: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  heroTitle: {
    color: colors.primaryText,
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 28,
  },
  heroTopicName: {
    fontStyle: 'italic',
  },
  heroSubtitle: {
    color: colors.primaryText,
    fontSize: 14,
    opacity: 0.7,
  },
  heroWatchTime: {
    color: colors.primaryText,
    fontSize: 12,
    opacity: 0.6,
    marginTop: spacing.xs,
  },

  // Section B — Questions header
  questionsHeader: {
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  questionsTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  questionsSubtitle: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },

  // Section C — Numbered question cards
  questionList: {
    gap: spacing.sm,
  },
  questionCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.md,
  },
  numberCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  numberText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  questionText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },

  // Section D — Footer
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  footerHeart: {
    color: colors.danger,
    fontSize: 14,
  },
  footerText: {
    color: colors.textMuted,
    fontSize: 12,
  },

  // Empty / error states
  emptyCard: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  emptyBody: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
});
