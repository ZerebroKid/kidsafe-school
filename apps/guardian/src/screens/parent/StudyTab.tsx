import React, {useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {colors, radius, spacing} from '../../theme';
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

/**
 * Recent-vs-earlier improvement signal for a subject. Median-split the topics
 * (already ordered oldest -> newest) and compare average best %. Needs >= 2
 * topics to be meaningful; small deltas read as "flat" to avoid noise.
 */
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
    // Oldest -> newest for the trend split; display list mirrors this so the
    // most recent topic shows last (parents read top-down chronologically).
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

/**
 * P4.11.1 -- parent Study sub-tab inside `ChildDetailsScreen`.
 *
 * Subject-organized view of a linked child's quiz performance. A Today/Overall
 * toggle switches the scope; results are grouped into collapsible per-subject
 * cards (avg best %, passed X/Y, progress bar, and a recent-vs-earlier
 * improvement trend). Built entirely from `quizAttempts` + `rewardUnlocks`,
 * both parent-readable via `isOwnChild(childUid)`.
 */
export function StudyTab({childUid}: {childUid: string}) {
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
    const topics = activeRows.length;
    const passed = activeRows.filter(r => r.passed).length;
    const avgBest =
      topics > 0
        ? Math.round(avg(activeRows.map(r => r.bestPercentage)))
        : 0;
    return {topics, passed, avgBest};
  }, [activeRows]);

  if (attempts.loading && !attempts.data) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (attempts.error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorBanner}>{attempts.error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.toggle}>
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
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>
            {scope === 'today' ? 'No quizzes yet today' : 'No quizzes yet'}
          </Text>
          <Text style={styles.emptyBody}>
            {scope === 'today'
              ? "When your child completes a topic quiz today, their score and any reward they unlock will show up here."
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
              valueColor={colors.success}
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
  const passRate = group.total > 0 ? group.passed / group.total : 0;
  const barColor = passRate >= 0.5 ? colors.success : colors.warning;
  const pct = Math.max(0, Math.min(100, group.avgBest));
  return (
    <View style={styles.subjectCard}>
      <Pressable onPress={onToggle} style={styles.subjectHeader}>
        <View style={styles.subjectHeaderText}>
          <Text style={styles.subjectName} numberOfLines={1}>
            {group.subject}
          </Text>
          <Text style={styles.subjectMeta}>
            {group.passed}/{group.total} passed
          </Text>
        </View>
        <TrendChip trend={group.trend} />
        <Text style={styles.subjectPct}>{pct}%</Text>
        <Text style={styles.chevron}>{expanded ? '▾' : '▸'}</Text>
      </Pressable>

      <View style={styles.track}>
        <View
          style={[styles.fill, {width: `${pct}%`, backgroundColor: barColor}]}
        />
      </View>

      {expanded ? (
        <View style={styles.topicList}>
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
  const pct = Math.max(0, Math.min(100, row.bestPercentage));
  const barColor = row.passed ? colors.success : colors.warning;
  return (
    <View style={styles.topicBlock}>
      {row.chapterName ? (
        <Text style={styles.eyebrow} numberOfLines={1}>
          {row.chapterName}
        </Text>
      ) : null}
      <View style={styles.topicHeader}>
        <Text style={styles.topicName} numberOfLines={1}>
          {row.topicName}
        </Text>
        <Text style={[styles.topicPct, {color: barColor}]}>{pct}%</Text>
      </View>
      <View style={styles.trackSm}>
        <View
          style={[styles.fill, {width: `${pct}%`, backgroundColor: barColor}]}
        />
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.meta} numberOfLines={1}>
          {row.attemptCount} {row.attemptCount === 1 ? 'attempt' : 'attempts'}
        </Text>
        <Text style={[styles.statusText, {color: barColor}]}>
          {row.passed ? 'Passed' : 'Keep going'}
        </Text>
      </View>
      {rewardTitle ? (
        <View style={styles.rewardChip}>
          <Text style={styles.rewardChipText} numberOfLines={1}>
            🎁 {rewardTitle}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function TrendChip({trend}: {trend: Trend | null}) {
  if (!trend) return null;
  const color =
    trend.direction === 'up'
      ? colors.success
      : trend.direction === 'down'
        ? colors.warning
        : colors.textMuted;
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
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, valueColor ? {color: valueColor} : null]}>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
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
  return (
    <Pressable
      onPress={onPress}
      style={[styles.toggleButton, active && styles.toggleButtonActive]}>
      <Text
        style={[styles.toggleLabel, active && styles.toggleLabelActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.md,
  },
  centered: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  toggle: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    padding: 4,
  },
  toggleButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  toggleButtonActive: {backgroundColor: colors.primary},
  toggleLabel: {color: colors.textMuted, fontSize: 13, fontWeight: '600'},
  toggleLabelActive: {color: colors.primaryText},
  statsRow: {flexDirection: 'row', gap: spacing.sm},
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    gap: 2,
  },
  statValue: {color: colors.text, fontSize: 20, fontWeight: '700'},
  statLabel: {color: colors.textMuted, fontSize: 11},
  subjectCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  subjectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  subjectHeaderText: {flex: 1},
  subjectName: {color: colors.text, fontSize: 16, fontWeight: '700'},
  subjectMeta: {color: colors.textMuted, fontSize: 12, marginTop: 1},
  subjectPct: {color: colors.text, fontSize: 16, fontWeight: '700'},
  chevron: {color: colors.textMuted, fontSize: 14, width: 14, textAlign: 'center'},
  trendChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  trendText: {fontSize: 11, fontWeight: '700'},
  track: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
  },
  trackSm: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
  },
  fill: {height: '100%', borderRadius: radius.pill},
  topicList: {
    gap: spacing.md,
    marginTop: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  topicBlock: {gap: spacing.xs},
  eyebrow: {
    color: colors.textMuted,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  topicHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  topicName: {flex: 1, color: colors.text, fontSize: 14, fontWeight: '600'},
  topicPct: {fontSize: 14, fontWeight: '700'},
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  meta: {flex: 1, color: colors.textMuted, fontSize: 12},
  statusText: {fontSize: 12, fontWeight: '700'},
  rewardChip: {
    alignSelf: 'flex-start',
    marginTop: 2,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
  },
  rewardChipText: {color: colors.text, fontSize: 12, fontWeight: '600'},
  emptyCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  emptyTitle: {color: colors.text, fontSize: 14, fontWeight: '700'},
  emptyBody: {color: colors.textMuted, fontSize: 13, lineHeight: 19},
  errorBanner: {
    color: colors.danger,
    fontSize: 13,
    padding: spacing.md,
  },
});
