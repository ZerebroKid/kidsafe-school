import React, {useMemo} from 'react';
import {ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import type {TeacherStackParamList} from '../../navigation/types';
import {cosmicColors, cosmicRadius, cosmicSpacing} from './theme';
import {CosmicBackground} from './components/CosmicBackground';
import {CosmicHeader} from './components/CosmicHeader';
import {ProgressRing} from './components/ProgressRing';
import {useChildQuizAttemptsAll} from '../../firebase/studyReports';

type Props = NativeStackScreenProps<TeacherStackParamList, 'TeacherStudentDetail'>;

const FALLBACK_TOPICS = [
  {name: 'Solving Basic Linear Equations', score: 57},
  {name: 'Variables on Both Sides', score: 37},
  {name: 'Word Problems on Linear Equations', score: 21},
];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function StudentDetailScreen({route, navigation}: Props) {
  const {
    studentUid,
    studentName = 'Student',
    rollNo = '01',
    classId,
    className = '8A',
    score = 35,
  } = route.params;

  const attemptsState = useChildQuizAttemptsAll(studentUid ?? null);
  const attempts = attemptsState.data ?? [];

  const {displayScore, topicList, weakestTopic} = useMemo(() => {
    if (attempts.length === 0) {
      return {
        displayScore: score,
        topicList: FALLBACK_TOPICS,
        weakestTopic: 'Word Problems on Linear Equations',
      };
    }
    const sum = attempts.reduce((acc, a) => acc + a.bestPercentage, 0);
    const avg = Math.round(sum / attempts.length);

    const list = attempts.map(a => ({
      name: a.topicName || 'Topic Quiz',
      score: a.bestPercentage,
    }));

    // Find lowest score topic
    const sorted = [...list].sort((a, b) => a.score - b.score);
    const weakest = sorted[0]?.name || 'Topic Practice';

    return {
      displayScore: avg,
      topicList: list,
      weakestTopic: weakest,
    };
  }, [attempts, score]);

  const initials = getInitials(studentName);
  const marks = `${Math.round((displayScore / 100) * 20)}/20`;

  return (
    <CosmicBackground>
      <CosmicHeader
        title="Student report"
        subtitle={`Class ${className}`}
        onBack={() => navigation.goBack()}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}>
        {/* Student Profile Header */}
        <View style={styles.profileRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.profileMeta}>
            <Text style={styles.name}>{studentName}</Text>
            <Text style={styles.sub}>
              Class {className} · Roll {rollNo}
            </Text>
          </View>
        </View>

        {/* Latest Quiz Card */}
        <View style={styles.quizCard}>
          <ProgressRing
            progress={displayScore}
            size={88}
            strokeWidth={9}
            color={displayScore < 50 ? cosmicColors.pink : cosmicColors.cyan}
            valueText={`${displayScore}%`}
          />
          <View style={styles.quizMeta}>
            <Text style={styles.quizTitle}>Latest performance</Text>
            <Text style={styles.quizSub}>
              {marks} marks · class average 68%
            </Text>
          </View>
        </View>

        {/* Topic-wise Marks Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Topic-wise marks</Text>
          {attemptsState.loading && attempts.length === 0 ? (
            <ActivityIndicator color={cosmicColors.purpleSoft} />
          ) : (
            <View style={styles.topicList}>
              {topicList.map(t => {
                const isWeak = t.score < 50;
                const barColor = isWeak ? cosmicColors.pink : cosmicColors.purple;
                const textColor = isWeak
                  ? cosmicColors.pinkLight
                  : cosmicColors.purpleSoft;

                return (
                  <View key={t.name} style={styles.topicCard}>
                    <View style={styles.topicHeader}>
                      <Text style={styles.topicName}>{t.name}</Text>
                      <Text style={[styles.topicScore, {color: textColor}]}>
                        {t.score}%
                      </Text>
                    </View>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          {width: `${t.score}%`, backgroundColor: barColor},
                        ]}
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Recommended Action Box */}
        <View style={styles.recommendCard}>
          <Text style={styles.recommendTag}>RECOMMENDED</Text>
          <Text style={styles.recommendText}>
            Re-teach{' '}
            <Text style={{fontWeight: '800', color: '#FFFFFF'}}>
              {weakestTopic}
            </Text>
            , then assign a short practice set to Class {className}.
          </Text>
          <Pressable
            style={styles.recommendBtn}
            onPress={() => {
              if (classId) {
                navigation.navigate('TeacherAssign', {
                  classId,
                  className,
                });
              } else {
                navigation.navigate('TeacherClasses');
              }
            }}>
            <Text style={styles.recommendBtnText}>
              Open Class {className} to assign
            </Text>
          </Pressable>
        </View>

        <View style={{height: 40}} />
      </ScrollView>
    </CosmicBackground>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  container: {
    paddingHorizontal: cosmicSpacing.lg,
    paddingTop: cosmicSpacing.xs,
    gap: cosmicSpacing.md,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: 'rgba(236, 72, 153, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(236, 72, 153, 0.38)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: cosmicColors.pinkLight,
    fontSize: 20,
    fontWeight: '800',
  },
  profileMeta: {
    flex: 1,
  },
  name: {
    color: cosmicColors.text,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  sub: {
    color: cosmicColors.textMuted,
    fontSize: 13,
    marginTop: 3,
  },
  quizCard: {
    padding: 18,
    borderRadius: cosmicRadius.xl,
    backgroundColor: cosmicColors.cardBg,
    borderWidth: 1,
    borderColor: cosmicColors.cardBorder,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  quizMeta: {
    flex: 1,
  },
  quizTitle: {
    color: cosmicColors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  quizSub: {
    color: cosmicColors.textMuted,
    fontSize: 12,
    marginTop: 4,
    lineHeight: 18,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    color: cosmicColors.text,
    fontSize: 13,
    fontWeight: '700',
    marginHorizontal: 2,
  },
  topicList: {
    gap: 10,
  },
  topicCard: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: cosmicColors.cardBgSubtle,
    borderWidth: 1,
    borderColor: cosmicColors.cardBorderSubtle,
    gap: 10,
  },
  topicHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  topicName: {
    flex: 1,
    color: cosmicColors.text,
    fontSize: 13.5,
    fontWeight: '600',
  },
  topicScore: {
    fontSize: 13,
    fontWeight: '700',
  },
  barTrack: {
    height: 7,
    borderRadius: cosmicRadius.pill,
    backgroundColor: cosmicColors.trackBg,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: cosmicRadius.pill,
  },
  recommendCard: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: 'rgba(139, 92, 246, 0.16)',
    borderWidth: 1,
    borderColor: cosmicColors.purpleBorder,
    gap: 8,
  },
  recommendTag: {
    color: cosmicColors.purpleLight,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  recommendText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
  },
  recommendBtn: {
    marginTop: 6,
    height: 48,
    borderRadius: 14,
    backgroundColor: cosmicColors.purple,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recommendBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
