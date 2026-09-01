import React, {useMemo} from 'react';
import {ActivityIndicator, StyleSheet, Text, View} from 'react-native';

import {useParentTheme} from '../../state/themeStore';
import {parentRadius, parentSpacing} from './theme/parentTheme';
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

import {Image} from 'react-native';
import {CosmicAssets} from '../../assets/cosmic';

export function ReelsInsightsTab({childUid, childName}: Props) {
  const {theme, isDark} = useParentTheme();
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
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  if (!insightsState.data || insightsState.data.length === 0) {
    return (
      <View style={styles.container}>
        <Image
          source={CosmicAssets.tReels}
          style={styles.heroBannerImg}
          resizeMode="cover"
        />
        <View
          style={[
            styles.emptyCard,
            {
              backgroundColor: isDark
                ? 'rgba(23, 19, 79, 0.88)'
                : theme.cardBg,
              borderColor: theme.cardBorder,
            },
          ]}>
          <Text style={[styles.emptyTitle, {color: theme.text}]}>
            No reel data yet
          </Text>
          <Text style={[styles.emptyBody, {color: theme.textMuted}]}>
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
      <Image
        source={CosmicAssets.tReels}
        style={styles.heroBannerImg}
        resizeMode="cover"
      />
      {/* Section A — Hero banner */}
      <View
        style={[
          styles.heroBanner,
          {
            backgroundColor: isDark
              ? 'rgba(109, 63, 231, 0.28)'
              : theme.primary,
            borderColor: isDark ? 'rgba(168, 85, 247, 0.45)' : theme.primary,
          },
        ]}>
        <Text style={[styles.heroTitle, {color: '#FFFFFF'}]}>
          {displayName} completed today's lesson on{' '}
          <Text style={[styles.heroTopicName, {color: theme.liveCyan}]}>
            {primaryTopic?.name ?? 'reels'}
          </Text>
        </Text>
        <Text style={[styles.heroSubtitle, {color: isDark ? '#E4DEFF' : 'rgba(255, 255, 255, 0.8)'}]}>
          ...and they don't even know it
        </Text>
        <Text style={[styles.heroWatchTime, {color: isDark ? '#C4B5FD' : 'rgba(255, 255, 255, 0.7)'}]}>
          Watched {formatWatchTime(todayDoc?.totalWatchedMs ?? 0)}
        </Text>
      </View>

      {/* Section B — Questions header */}
      {primaryQuestions && (
        <View style={styles.questionsHeader}>
          <Text style={[styles.questionsTitle, {color: theme.text}]}>
            Ask them these {primaryQuestions.questions.length} questions tonight
          </Text>
          <Text style={[styles.questionsSubtitle, {color: theme.textMuted}]}>
            A 2-minute chat at dinner tells you if they truly get it.
          </Text>
        </View>
      )}

      {/* Section C — Numbered question cards */}
      {primaryQuestions ? (
        <View style={styles.questionList}>
          {primaryQuestions.questions.map((q, i) => (
            <View
              key={i}
              style={[
                styles.questionCard,
                {
                  backgroundColor: isDark
                    ? 'rgba(23, 19, 79, 0.88)'
                    : theme.cardBg,
                  borderColor: theme.cardBorder,
                },
              ]}>
              <View
                style={[
                  styles.numberCircle,
                  {
                    backgroundColor: isDark
                      ? 'rgba(109, 63, 231, 0.25)'
                      : '#EFE7F8',
                  },
                ]}>
                <Text
                  style={[
                    styles.numberText,
                    {color: isDark ? '#E4DEFF' : theme.primary},
                  ]}>
                  {i + 1}
                </Text>
              </View>
              <Text style={[styles.questionText, {color: theme.text}]}>
                {q}
              </Text>
            </View>
          ))}
        </View>
      ) : topicRows.length > 0 ? (
        <View
          style={[
            styles.emptyCard,
            {
              backgroundColor: isDark
                ? 'rgba(23, 19, 79, 0.88)'
                : theme.cardBg,
              borderColor: theme.cardBorder,
            },
          ]}>
          <Text style={[styles.emptyTitle, {color: theme.text}]}>
            No questions for today's topics
          </Text>
          <Text style={[styles.emptyBody, {color: theme.textMuted}]}>
            Your child watched some reels, but no discussion questions are
            available for those topics yet.
          </Text>
        </View>
      ) : (
        <View
          style={[
            styles.emptyCard,
            {
              backgroundColor: isDark
                ? 'rgba(23, 19, 79, 0.88)'
                : theme.cardBg,
              borderColor: theme.cardBorder,
            },
          ]}>
          <Text style={[styles.emptyTitle, {color: theme.text}]}>
            No reels watched today
          </Text>
          <Text style={[styles.emptyBody, {color: theme.textMuted}]}>
            Check back later once your child watches some reels.
          </Text>
        </View>
      )}

      {/* Section D — Footer */}
      <View style={styles.footer}>
        <Text style={[styles.footerHeart, {color: theme.danger}]}>
          &#x2764;
        </Text>
        <Text style={[styles.footerText, {color: theme.textMuted}]}>
          Learning becomes a warm family moment.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: parentSpacing.lg,
    paddingTop: parentSpacing.xs,
    paddingBottom: parentSpacing.lg,
    gap: parentSpacing.md,
  },
  center: {
    padding: parentSpacing.xl,
    alignItems: 'center',
  },
  heroBanner: {
    borderRadius: parentRadius.xl,
    padding: parentSpacing.lg,
    gap: parentSpacing.xs,
    borderWidth: 1,
  },
  heroTitle: {
    fontSize: 19,
    fontWeight: '800',
    lineHeight: 26,
  },
  heroTopicName: {
    fontStyle: 'italic',
    fontWeight: '800',
  },
  heroSubtitle: {
    fontSize: 13.5,
    marginTop: 2,
  },
  heroWatchTime: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: parentSpacing.xs,
  },
  questionsHeader: {
    gap: parentSpacing.xs,
    marginTop: parentSpacing.xs,
  },
  questionsTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  questionsSubtitle: {
    fontSize: 12.5,
    lineHeight: 18,
  },
  questionList: {
    gap: 10,
  },
  questionCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: parentRadius.lg,
    padding: parentSpacing.md,
    gap: 12,
    borderWidth: 1,
  },
  numberCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  numberText: {
    fontSize: 13,
    fontWeight: '700',
  },
  questionText: {
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: parentSpacing.sm,
    marginTop: parentSpacing.md,
    paddingBottom: parentSpacing.sm,
  },
  footerHeart: {
    fontSize: 14,
  },
  footerText: {
    fontSize: 12,
  },
  emptyCard: {
    borderRadius: parentRadius.lg,
    borderWidth: 1,
    padding: parentSpacing.lg,
    gap: parentSpacing.xs,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  emptyBody: {
    fontSize: 13,
    lineHeight: 19,
  },
  heroBannerImg: {
    width: '100%',
    height: 140,
    borderRadius: 22,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(233,92,255,0.24)',
  },
});
