import React, {useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {useParentTheme} from '../../state/themeStore';
import {parentRadius, parentSpacing} from './theme/parentTheme';
import {CosmicAssets} from '../../assets/cosmic';
import {
  useChildQuizAttemptsAll,
  useChildRewardUnlocks,
  type QuizAttemptRow,
} from '../../firebase/studyReports';
import {todayInSchoolTz} from '../../firebase/teacher';

type Scope = 'today' | 'overall';

interface Trend {
  delta: number;
  direction: 'up' | 'down' | 'flat';
}

interface SubjectGroup {
  subject: string;
  topics: QuizAttemptRow[];
  avgBest: number;
  passed: number;
  total: number;
  trend: Trend | null;
}

const TREND_THRESHOLD = 3;

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function computeTrend(ordered: QuizAttemptRow[]): Trend | null {
  if (ordered.length < 2) return null;
  const mid = Math.floor(ordered.length / 2);
  const earlier = ordered.slice(0, mid).map(r => r.bestPercentage);
  const recent = ordered.slice(mid).map(r => r.bestPercentage);
  const delta = Math.round(avg(recent) - avg(earlier));
  const direction =
    delta > TREND_THRESHOLD ? 'up' : delta < -TREND_THRESHOLD ? 'down' : 'flat';
  return {delta, direction};
}

function buildGroups(rows: QuizAttemptRow[]): SubjectGroup[] {
  const bySubject = new Map<string, QuizAttemptRow[]>();
  for (const r of rows) {
    const key = r.subjectName || 'Other';
    const list = bySubject.get(key) ?? [];
    list.push(r);
    bySubject.set(key, list);
  }
  const groups: SubjectGroup[] = [];
  for (const [subject, list] of bySubject) {
    const ordered = [...list].sort((a, b) => {
      if (a.assignedDate !== b.assignedDate) {
        return a.assignedDate < b.assignedDate ? -1 : 1;
      }
      return a.updatedAtMs - b.updatedAtMs;
    });
    const passed = ordered.filter(r => r.passed).length;
    groups.push({
      subject,
      topics: ordered,
      avgBest: Math.round(avg(ordered.map(r => r.bestPercentage))),
      passed,
      total: ordered.length,
      trend: computeTrend(ordered),
    });
  }
  return groups.sort((a, b) => a.subject.localeCompare(b.subject));
}

export function StudyTab({childUid}: {childUid: string}) {
  const {theme, isDark} = useParentTheme();
  const attempts = useChildQuizAttemptsAll(childUid);
  const rewards = useChildRewardUnlocks(childUid);

  const [scope, setScope] = useState<Scope>('today');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const rewardByAttempt = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rewards.data ?? []) {
      if (r.attemptId) map.set(r.attemptId, r.rewardTitle);
    }
    return map;
  }, [rewards.data]);

  const allRows = attempts.data ?? [];

  const activeRows = useMemo(() => {
    if (scope === 'overall') return allRows;
    const today = todayInSchoolTz();
    return allRows.filter(r => r.assignedDate === today);
  }, [allRows, scope]);

  const groups = useMemo(() => buildGroups(activeRows), [activeRows]);

  const summary = useMemo(() => {
    const totalTopics = activeRows.length;
    const passed = activeRows.filter(r => r.passed).length;
    const avgBest = Math.round(avg(activeRows.map(r => r.bestPercentage)));
    return {topics: totalTopics, passed, avgBest};
  }, [activeRows]);

  if (attempts.loading || rewards.loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  if (attempts.error) {
    return (
      <View style={styles.centered}>
        <Text style={[styles.errorBanner, {color: theme.danger}]}>
          {attempts.error}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Image
        source={CosmicAssets.tStudy}
        style={styles.heroBannerImg}
        resizeMode="cover"
      />
      <View
        style={[
          styles.toggle,
          {
            backgroundColor: isDark
              ? 'rgba(255, 255, 255, 0.08)'
              : '#EFE7F8',
          },
        ]}>
        <ToggleButton
          label="Today"
          active={scope === 'today'}
          onPress={() => setScope('today')}
        />
        <ToggleButton
          label="Overall"
          active={scope === 'overall'}
          onPress={() => setScope('overall')}
        />
      </View>

      {activeRows.length === 0 ? (
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
            {scope === 'today' ? 'No quizzes yet today' : 'No quizzes yet'}
          </Text>
          <Text style={[styles.emptyBody, {color: theme.textMuted}]}>
            {scope === 'today'
              ? 'When your child completes a topic quiz today, their score and any reward they unlock will show up here.'
              : 'When your child completes topic quizzes, their subject-wise performance will appear here.'}
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.statsRow}>
            <StatCard value={`${summary.topics}`} label="Topics" />
            <StatCard value={`${summary.avgBest}%`} label="Avg best" />
            <StatCard
              value={`${summary.passed}`}
              label="Passed"
              valueColor={theme.successGreen}
            />
          </View>

          {groups.map(group => (
            <SubjectCard
              key={group.subject}
              group={group}
              expanded={!!expanded[group.subject]}
              onToggle={() =>
                setExpanded(prev => ({
                  ...prev,
                  [group.subject]: !prev[group.subject],
                }))
              }
              rewardByAttempt={rewardByAttempt}
            />
          ))}
        </>
      )}
    </View>
  );
}

function SubjectCard({
  group,
  expanded,
  onToggle,
  rewardByAttempt,
}: {
  group: SubjectGroup;
  expanded: boolean;
  onToggle: () => void;
  rewardByAttempt: Map<string, string>;
}) {
  const {theme, isDark} = useParentTheme();
  const passRate = group.total > 0 ? group.passed / group.total : 0;
  const barColor = passRate >= 0.5 ? theme.successGreen : theme.warning;
  const pct = Math.max(0, Math.min(100, group.avgBest));
  return (
    <View
      style={[
        styles.subjectCard,
        {
          backgroundColor: isDark
            ? 'rgba(23, 19, 79, 0.88)'
            : theme.cardBg,
          borderColor: theme.cardBorder,
        },
      ]}>
      <Pressable onPress={onToggle} style={styles.subjectHeader}>
        <View style={styles.subjectHeaderText}>
          <Text
            style={[styles.subjectName, {color: theme.text}]}
            numberOfLines={1}>
            {group.subject}
          </Text>
          <Text style={[styles.subjectMeta, {color: theme.textMuted}]}>
            {group.passed}/{group.total} passed
          </Text>
        </View>
        <TrendChip trend={group.trend} />
        <Text style={[styles.subjectPct, {color: theme.text}]}>{pct}%</Text>
        <Text style={[styles.chevron, {color: theme.textSubtle}]}>
          {expanded ? '▾' : '▸'}
        </Text>
      </Pressable>

      <View
        style={[
          styles.track,
          {backgroundColor: theme.trackBg},
        ]}>
        <View
          style={[styles.fill, {width: `${pct}%`, backgroundColor: barColor}]}
        />
      </View>

      {expanded ? (
        <View
          style={[
            styles.topicList,
            {borderTopColor: theme.cardBorderSubtle},
          ]}>
          {group.topics.map(row => (
            <TopicBar
              key={row.id}
              row={row}
              rewardTitle={rewardByAttempt.get(row.id)}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function TopicBar({
  row,
  rewardTitle,
}: {
  row: QuizAttemptRow;
  rewardTitle?: string;
}) {
  const {theme, isDark} = useParentTheme();
  const pct = Math.max(0, Math.min(100, row.bestPercentage));
  const barColor = row.passed ? theme.successGreen : theme.warning;
  return (
    <View style={styles.topicBlock}>
      {row.chapterName ? (
        <Text
          style={[styles.eyebrow, {color: theme.textSubtle}]}
          numberOfLines={1}>
          {row.chapterName}
        </Text>
      ) : null}
      <View style={styles.topicHeader}>
        <Text
          style={[styles.topicName, {color: theme.text}]}
          numberOfLines={1}>
          {row.topicName}
        </Text>
        <Text style={[styles.topicPct, {color: barColor}]}>{pct}%</Text>
      </View>
      <View
        style={[
          styles.trackSm,
          {backgroundColor: theme.trackBg},
        ]}>
        <View
          style={[styles.fill, {width: `${pct}%`, backgroundColor: barColor}]}
        />
      </View>
      <View style={styles.metaRow}>
        <Text
          style={[styles.meta, {color: theme.textMuted}]}
          numberOfLines={1}>
          {row.attemptCount} {row.attemptCount === 1 ? 'attempt' : 'attempts'}
        </Text>
        <Text style={[styles.statusText, {color: barColor}]}>
          {row.passed ? 'Passed' : 'Keep going'}
        </Text>
      </View>
      {rewardTitle ? (
        <View
          style={[
            styles.rewardChip,
            {
              backgroundColor: isDark
                ? 'rgba(109, 63, 231, 0.25)'
                : '#EFE7F8',
            },
          ]}>
          <Text
            style={[styles.rewardChipText, {color: theme.text}]}
            numberOfLines={1}>
            🎁 {rewardTitle}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function TrendChip({trend}: {trend: Trend | null}) {
  const {theme} = useParentTheme();
  if (!trend) return null;
  const color =
    trend.direction === 'up'
      ? theme.successGreen
      : trend.direction === 'down'
        ? theme.warning
        : theme.textMuted;
  const arrow =
    trend.direction === 'up' ? '↑' : trend.direction === 'down' ? '↓' : '→';
  const label =
    trend.direction === 'flat'
      ? 'Steady'
      : `${trend.delta > 0 ? '+' : ''}${trend.delta}%`;
  return (
    <View style={[styles.trendChip, {backgroundColor: `${color}22`}]}>
      <Text style={[styles.trendText, {color}]}>
        {arrow} {label}
      </Text>
    </View>
  );
}

function StatCard({
  value,
  label,
  valueColor,
}: {
  value: string;
  label: string;
  valueColor?: string;
}) {
  const {theme, isDark} = useParentTheme();
  return (
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
      <Text
        style={[
          styles.statValue,
          {color: valueColor ?? theme.text},
        ]}>
        {value}
      </Text>
      <Text style={[styles.statLabel, {color: theme.textMuted}]}>
        {label}
      </Text>
    </View>
  );
}

function ToggleButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const {theme, isDark} = useParentTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.toggleButton,
        active && {
          backgroundColor: theme.primary,
        },
      ]}>
      <Text
        style={[
          styles.toggleLabel,
          {
            color: active
              ? '#FFFFFF'
              : isDark
              ? theme.textMuted
              : theme.text,
            fontWeight: active ? '700' : '600',
          },
        ]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: parentSpacing.lg,
    paddingTop: parentSpacing.xs,
    gap: parentSpacing.md,
  },
  centered: {
    paddingVertical: parentSpacing.xl,
    alignItems: 'center',
  },
  toggle: {
    flexDirection: 'row',
    borderRadius: parentRadius.pill,
    padding: 4,
  },
  toggleButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: parentRadius.pill,
  },
  toggleLabel: {fontSize: 13},
  statsRow: {flexDirection: 'row', gap: 10},
  statCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: parentRadius.lg,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 3,
  },
  statValue: {fontSize: 19, fontWeight: '800'},
  statLabel: {fontSize: 11, fontWeight: '600'},
  subjectCard: {
    borderWidth: 1,
    borderRadius: parentRadius.lg,
    padding: parentSpacing.md,
    gap: parentSpacing.sm,
  },
  subjectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: parentSpacing.sm,
  },
  subjectHeaderText: {flex: 1},
  subjectName: {fontSize: 15, fontWeight: '700'},
  subjectMeta: {fontSize: 12, marginTop: 1},
  subjectPct: {fontSize: 15, fontWeight: '700'},
  chevron: {fontSize: 14, width: 14, textAlign: 'center'},
  trendChip: {
    paddingHorizontal: parentSpacing.sm,
    paddingVertical: 2,
    borderRadius: parentRadius.pill,
  },
  trendText: {fontSize: 11, fontWeight: '700'},
  track: {
    height: 7,
    borderRadius: parentRadius.pill,
    overflow: 'hidden',
  },
  trackSm: {
    height: 6,
    borderRadius: parentRadius.pill,
    overflow: 'hidden',
  },
  fill: {height: '100%', borderRadius: parentRadius.pill},
  topicList: {
    gap: parentSpacing.md,
    marginTop: parentSpacing.xs,
    paddingTop: parentSpacing.sm,
    borderTopWidth: 1,
  },
  topicBlock: {gap: 4},
  eyebrow: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '700',
  },
  topicHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: parentSpacing.sm,
  },
  topicName: {flex: 1, fontSize: 13.5, fontWeight: '600'},
  topicPct: {fontSize: 13.5, fontWeight: '700'},
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: parentSpacing.sm,
  },
  meta: {flex: 1, fontSize: 11},
  statusText: {fontSize: 11, fontWeight: '700'},
  rewardChip: {
    alignSelf: 'flex-start',
    marginTop: 2,
    paddingHorizontal: parentSpacing.sm,
    paddingVertical: 3,
    borderRadius: parentRadius.pill,
  },
  rewardChipText: {fontSize: 11, fontWeight: '600'},
  emptyCard: {
    borderWidth: 1,
    borderRadius: parentRadius.lg,
    padding: parentSpacing.lg,
    gap: 4,
  },
  emptyTitle: {fontSize: 15, fontWeight: '700'},
  emptyBody: {fontSize: 13, lineHeight: 19},
  errorBanner: {
    fontSize: 13,
    padding: parentSpacing.md,
  },
  heroBannerImg: {
    width: '100%',
    height: 140,
    borderRadius: 22,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(85,217,139,0.24)',
  },
});
