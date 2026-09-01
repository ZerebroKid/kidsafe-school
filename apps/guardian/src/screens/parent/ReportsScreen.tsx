import React, {useEffect, useMemo, useState} from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  subscribeChildDoc,
  subscribeLinkedChildren,
} from '@zerebro/shared-firebase/firestore';
import {useAuthStore} from '../../state/authStore';
import {useParentTheme} from '../../state/themeStore';
import {useChildQuizAttemptsAll} from '../../firebase/studyReports';
import type {ChildDoc, UserDoc} from '@zerebro/shared-types';
import {ParentBackground} from './components/ParentBackground';
import {ParentHeader} from './components/ParentHeader';
import {parentRadius, parentSpacing} from './theme/parentTheme';

import {Image} from 'react-native';
import {CosmicAssets} from '../../assets/cosmic';

type ChildRow = UserDoc & {uid: string; doc: ChildDoc | null};

const WEEKLY_DATA = [
  {day: 'Mon', pct: 60},
  {day: 'Tue', pct: 85},
  {day: 'Wed', pct: 40},
  {day: 'Thu', pct: 95},
  {day: 'Fri', pct: 80},
];

const DEFAULT_SUBJECTS = [
  {subject: 'Science', score: 92, status: 'Strong', color: '#55D98B'},
  {subject: 'Mathematics', score: 84, status: 'On track', color: '#35D9FF'},
  {subject: 'English', score: 70, status: 'Needs practice', color: '#C084FC'},
];

const APP_USAGE = [
  {name: 'KidSafe Study', category: 'Education', time: '45m', pct: 60, icon: CosmicAssets.aQuiz},
  {name: 'Photos', category: 'Creative', time: '20m', pct: 25, icon: CosmicAssets.aPhotos},
  {name: 'YouTube', category: 'Entertainment', time: '15m', pct: 15, icon: CosmicAssets.aYoutube},
];

export function ReportsScreen({route}: {route?: {params?: {childUid?: string; childName?: string}}}) {
  const paramChildUid = route?.params?.childUid;
  const parentUid = useAuthStore(s => s.firebaseUid);
  const {theme, isDark} = useParentTheme();

  const [rows, setRows] = useState<ChildRow[]>([]);
  const [selectedChildUid, setSelectedChildUid] = useState<string | null>(paramChildUid ?? null);

  useEffect(() => {
    if (paramChildUid) {
      setSelectedChildUid(paramChildUid);
    }
  }, [paramChildUid]);

  useEffect(() => {
    if (!parentUid) return;
    const subs: Array<() => void> = [];
    const unsub = subscribeLinkedChildren(parentUid, list => {
      setRows(list.map(u => ({...u, doc: null})));
      subs.forEach(u => u());
      subs.length = 0;
      list.forEach(u => {
        const us = subscribeChildDoc(u.uid, doc => {
          setRows(prev => prev.map(r => (r.uid === u.uid ? {...r, doc} : r)));
        });
        subs.push(us);
      });
    });
    return () => {
      unsub();
      subs.forEach(u => u());
    };
  }, [parentUid]);

  const activeChild = useMemo(() => {
    if (selectedChildUid) {
      const found = rows.find(r => r.uid === selectedChildUid);
      if (found) return found;
    }
    return rows[0] ?? null;
  }, [rows, selectedChildUid]);

  const activeName = activeChild?.name ?? activeChild?.displayName ?? 'Child';

  // Live quiz attempts data
  const attemptsState = useChildQuizAttemptsAll(activeChild?.uid ?? null);
  const attempts = attemptsState.data ?? [];

  const {avgScore, passedCount, totalSubjectsCount, subjectsMastery} = useMemo(() => {
    if (attempts.length === 0) {
      return {
        avgScore: 85,
        passedCount: 2,
        totalSubjectsCount: 3,
        subjectsMastery: DEFAULT_SUBJECTS,
      };
    }
    const sum = attempts.reduce((acc, a) => acc + a.bestPercentage, 0);
    const avg = Math.round(sum / attempts.length);
    const passed = attempts.filter(a => a.passed).length;

    const subjectsMap = new Map<string, {totalPct: number; count: number}>();
    for (const a of attempts) {
      const sub = a.subjectName || 'General';
      const cur = subjectsMap.get(sub) ?? {totalPct: 0, count: 0};
      subjectsMap.set(sub, {
        totalPct: cur.totalPct + a.bestPercentage,
        count: cur.count + 1,
      });
    }

    const masteryList = Array.from(subjectsMap.entries()).map(([sub, data]) => {
      const score = Math.round(data.totalPct / data.count);
      let status = 'Needs practice';
      let color = theme.warning;
      if (score >= 80) {
        status = 'Strong';
        color = theme.successGreen;
      } else if (score >= 50) {
        status = 'On track';
        color = theme.liveCyan;
      }
      return {subject: sub, score, status, color};
    });

    return {
      avgScore: Math.max(0, Math.min(100, avg)),
      passedCount: passed,
      totalSubjectsCount: Math.max(1, subjectsMap.size),
      subjectsMastery: masteryList.length > 0 ? masteryList : DEFAULT_SUBJECTS,
    };
  }, [attempts, theme]);

  return (
    <ParentBackground>
      <ParentHeader
        title="Reports"
        subtitle={`Learning & activity overview for ${activeName}`}
        showBack={false}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}>
        {/* Child Selector Pill if multiple children */}
        {rows.length > 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.childTabsRow}>
            {rows.map(r => {
              const name = r.name ?? r.displayName ?? 'Child';
              const isCur = r.uid === activeChild?.uid;
              return (
                <Pressable
                  key={r.uid}
                  style={[
                    styles.childPill,
                    {
                      backgroundColor: isCur
                        ? theme.primary
                        : isDark
                        ? 'rgba(255, 255, 255, 0.08)'
                        : '#FFFFFF',
                      borderColor: isCur ? theme.primary : theme.cardBorder,
                    },
                  ]}
                  onPress={() => setSelectedChildUid(r.uid)}>
                  <Text
                    style={[
                      styles.childPillText,
                      {
                        color: isCur
                          ? '#FFFFFF'
                          : isDark
                          ? theme.textMuted
                          : theme.text,
                      },
                    ]}>
                    {name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        {/* 3 Metric Stat Cards */}
        <View style={styles.statsRow}>
          <View
            style={[
              styles.statCard,
              {
                backgroundColor: isDark
                  ? 'rgba(23, 19, 79, 0.88)'
                  : theme.cardBg,
                borderColor: theme.cardBorder,
              },
            ]}>
            <Text style={[styles.statValue, {color: theme.liveCyan}]}>{avgScore}%</Text>
            <Text style={[styles.statLabel, {color: theme.textMuted}]}>
              Quiz Score
            </Text>
          </View>
          <View
            style={[
              styles.statCard,
              {
                backgroundColor: isDark
                  ? 'rgba(23, 19, 79, 0.88)'
                  : theme.cardBg,
                borderColor: theme.cardBorder,
              },
            ]}>
            <Text style={[styles.statValue, {color: theme.successGreen}]}>
              {passedCount} / {totalSubjectsCount}
            </Text>
            <Text style={[styles.statLabel, {color: theme.textMuted}]}>
              Topics Passed
            </Text>
          </View>
          <View
            style={[
              styles.statCard,
              {
                backgroundColor: isDark
                  ? 'rgba(23, 19, 79, 0.88)'
                  : theme.cardBg,
                borderColor: theme.cardBorder,
              },
            ]}>
            <Text style={[styles.statValue, {color: isDark ? '#C084FC' : theme.primary}]}>
              1h 20m
            </Text>
            <Text style={[styles.statLabel, {color: theme.textMuted}]}>
              Screen Time
            </Text>
          </View>
        </View>

        {/* Weekly Study Consistency Chart Card */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: isDark
                ? 'rgba(23, 19, 79, 0.88)'
                : theme.cardBg,
              borderColor: theme.cardBorder,
            },
          ]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, {color: theme.text}]}>
              Weekly Study Consistency
            </Text>
            <Text style={[styles.cardTag, {color: theme.liveCyan}]}>
              Active Consistency
            </Text>
          </View>

          <View style={styles.barChartRow}>
            {WEEKLY_DATA.map(d => (
              <View key={d.day} style={styles.barCol}>
                <View
                  style={[
                    styles.barTrack,
                    {backgroundColor: theme.trackBg},
                  ]}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        height: `${d.pct}%`,
                        backgroundColor:
                          d.pct >= 80 ? theme.successGreen : theme.primary,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.barDayText, {color: theme.textMuted}]}>
                  {d.day}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Subject Mastery List Card */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: isDark
                ? 'rgba(23, 19, 79, 0.88)'
                : theme.cardBg,
              borderColor: theme.cardBorder,
            },
          ]}>
          <Text style={[styles.cardTitle, {color: theme.text}]}>
            Subject Mastery
          </Text>
          <View style={styles.subjectsList}>
            {subjectsMastery.map(s => (
              <View key={s.subject} style={styles.subjectRow}>
                <View style={styles.subjectInfo}>
                  <Text style={[styles.subjectName, {color: theme.text}]}>
                    {s.subject}
                  </Text>
                  <Text style={[styles.subjectScore, {color: s.color}]}>
                    {s.score}% · {s.status}
                  </Text>
                </View>
                <View
                  style={[
                    styles.subjectBarTrack,
                    {backgroundColor: theme.trackBg},
                  ]}>
                  <View
                    style={[
                      styles.subjectBarFill,
                      {width: `${s.score}%`, backgroundColor: s.color},
                    ]}
                  />
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* App Usage Breakdown Card */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: isDark
                ? 'rgba(23, 19, 79, 0.88)'
                : theme.cardBg,
              borderColor: theme.cardBorder,
            },
          ]}>
          <Text style={[styles.cardTitle, {color: theme.text}]}>
            Today's App Activity
          </Text>
          <View style={styles.appUsageList}>
            {APP_USAGE.map(a => (
              <View key={a.name} style={styles.appUsageRow}>
                <View style={styles.appUsageHeader}>
                  <View style={{flexDirection: 'row', alignItems: 'center', gap: 10}}>
                    {a.icon && (
                      <Image
                        source={a.icon}
                        style={{width: 32, height: 32, borderRadius: 10}}
                        resizeMode="contain"
                      />
                    )}
                    <View>
                      <Text style={[styles.appUsageName, {color: theme.text}]}>
                        {a.name}
                      </Text>
                      <Text
                        style={[styles.appUsageCat, {color: theme.textMuted}]}>
                        {a.category}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.appUsageTime, {color: theme.text}]}>
                    {a.time}
                  </Text>
                </View>
                <View
                  style={[
                    styles.appBarTrack,
                    {backgroundColor: theme.trackBg},
                  ]}>
                  <View
                    style={[
                      styles.appBarFill,
                      {
                        width: `${a.pct}%`,
                        backgroundColor:
                          a.name === 'KidSafe Study'
                            ? theme.successGreen
                            : theme.primary,
                      },
                    ]}
                  />
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={{height: 40}} />
      </ScrollView>
    </ParentBackground>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  container: {
    paddingHorizontal: parentSpacing.lg,
    paddingTop: parentSpacing.xs,
    gap: parentSpacing.md,
  },
  childTabsRow: {
    gap: 8,
    paddingBottom: 4,
  },
  childPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: parentRadius.pill,
    borderWidth: 1,
  },
  childPillText: {
    fontSize: 13,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: parentRadius.lg,
    borderWidth: 1,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  card: {
    borderRadius: parentRadius.xl,
    borderWidth: 1,
    padding: 18,
    gap: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  cardTag: {
    fontSize: 12,
    fontWeight: '700',
  },
  barChartRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 100,
    paddingHorizontal: 10,
    paddingTop: 10,
  },
  barCol: {
    alignItems: 'center',
    gap: 8,
    height: '100%',
    justifyContent: 'flex-end',
  },
  barTrack: {
    width: 24,
    height: 70,
    borderRadius: 12,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  barFill: {
    width: '100%',
    borderRadius: 12,
  },
  barDayText: {
    fontSize: 11,
    fontWeight: '600',
  },
  subjectsList: {
    gap: 12,
  },
  subjectRow: {
    gap: 6,
  },
  subjectInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  subjectName: {
    fontSize: 14,
    fontWeight: '600',
  },
  subjectScore: {
    fontSize: 12,
    fontWeight: '700',
  },
  subjectBarTrack: {
    height: 7,
    borderRadius: parentRadius.pill,
    overflow: 'hidden',
  },
  subjectBarFill: {
    height: '100%',
    borderRadius: parentRadius.pill,
  },
  appUsageList: {
    gap: 12,
  },
  appUsageRow: {
    gap: 6,
  },
  appUsageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  appUsageName: {
    fontSize: 14,
    fontWeight: '600',
  },
  appUsageCat: {
    fontSize: 11,
    marginTop: 1,
  },
  appUsageTime: {
    fontSize: 13,
    fontWeight: '700',
  },
  appBarTrack: {
    height: 6,
    borderRadius: parentRadius.pill,
    overflow: 'hidden',
  },
  appBarFill: {
    height: '100%',
    borderRadius: parentRadius.pill,
  },
});
