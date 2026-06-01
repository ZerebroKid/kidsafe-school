import React, {useEffect, useMemo, useState} from 'react';
import {Image, StyleSheet, Text, View} from 'react-native';

import {colors, radius, spacing} from '../../theme';
import {
  formatDateKey,
  subscribeChildApps,
  subscribeUsageWeek,
} from '@zerebro/shared-firebase/firestore';
import type {AppEntry, UsageDailyDoc} from '@zerebro/shared-types';
import {UsageBarChart, type ChartDay} from './UsageBarChart';

interface Props {
  childUid: string;
}

/**
 * "App Usage" tab body.
 *
 * Reads the last 7 `usageDaily` docs and the `apps` subcollection from Firestore. Joins them
 * to render:
 *
 *   1. A header card with the selected day's total screen time (defaults to today).
 *   2. A weekly bar chart — tap any day to switch the rest of the screen to that day.
 *   3. A daily-average + weekly-total summary row.
 *   4. The per-app list for the selected day, sorted by minutes desc, with proportional
 *      progress bars.
 *
 * Empty state: if no `usageDaily` docs exist yet, prompts the parent to wait or check that
 * the child granted Usage Access (the most common reason data won't appear).
 */
export function UsageTab({childUid}: Props) {
  const [weekDocs, setWeekDocs] = useState<UsageDailyDoc[]>([]);
  const [apps, setApps] = useState<AppEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(() =>
    formatDateKey(new Date()),
  );

  useEffect(() => subscribeUsageWeek(childUid, setWeekDocs, 7), [childUid]);
  useEffect(() => subscribeChildApps(childUid, setApps), [childUid]);

  // Build a 7-slot array starting six days ago through today, filling missing days with a
  // zero-mins placeholder. The chart relies on this fixed-length array for stable bar
  // positions across re-renders (don't sort or filter — UsageBarChart trusts the order).
  const todayKey = formatDateKey(new Date());
  const chartDays = useMemo<ChartDay[]>(() => {
    const byDate = new Map(weekDocs.map(d => [d.date, d]));
    const out: ChartDay[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = formatDateKey(d);
      out.push({
        date: key,
        totalMins: byDate.get(key)?.totalMins ?? 0,
        isToday: key === todayKey,
      });
    }
    return out;
  }, [weekDocs, todayKey]);

  const selectedDoc = weekDocs.find(d => d.date === selectedDate) ?? null;

  // Summary stats. We compute over the actual 7-slot chart array (so missing days count as
  // zero) — matches the visual the parent sees in the chart.
  const weekTotalMins = chartDays.reduce((sum, d) => sum + d.totalMins, 0);
  const dailyAvgMins = Math.round(weekTotalMins / chartDays.length);

  // Per-app rows for the selected day. Joined with `apps` subcollection for icons + names.
  // Apps that no longer appear in the subcollection (uninstalled mid-week) still show — we
  // just fall back to the package name.
  const appByPkg = useMemo(
    () => new Map(apps.map(a => [a.packageName, a])),
    [apps],
  );
  const rows = useMemo(() => {
    if (!selectedDoc) {return [];}
    const entries = Object.entries(selectedDoc.perApp).sort((a, b) => b[1] - a[1]);
    const peak = entries[0]?.[1] ?? 0;
    return entries.map(([pkg, mins]) => ({
      pkg,
      mins,
      meta: appByPkg.get(pkg),
      // Bar width 0..1 relative to the day's most-used app (so the top app always fills).
      ratio: peak > 0 ? mins / peak : 0,
    }));
  }, [selectedDoc, appByPkg]);

  const noData = weekDocs.length === 0;

  return (
    <View style={styles.container}>
      <SelectedDayHeader
        selectedDate={selectedDate}
        todayKey={todayKey}
        totalMins={selectedDoc?.totalMins ?? 0}
        noData={noData}
      />

      <UsageBarChart
        days={chartDays}
        selectedDate={selectedDate}
        onSelect={setSelectedDate}
      />

      <View style={styles.summaryRow}>
        <SummaryPill label="Daily average" value={formatHm(dailyAvgMins)} />
        <SummaryPill label="Weekly total" value={formatHm(weekTotalMins)} />
      </View>

      <Text style={styles.sectionTitle}>
        {selectedDate === todayKey ? "Today's apps" : `${weekdayLong(selectedDate)} apps`}
      </Text>

      {noData ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Waiting for usage data</Text>
          <Text style={styles.emptyBody}>
            Make sure your child granted "Usage access" in KidSafe. The first batch of data
            usually arrives within 10 minutes of opening the app.
          </Text>
        </View>
      ) : rows.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No apps used</Text>
          <Text style={styles.emptyBody}>
            Your child didn't use any apps for more than a minute on this day.
          </Text>
        </View>
      ) : (
        <View style={styles.appList}>
          {rows.map(r => (
            <View key={r.pkg} style={styles.appRow}>
              {r.meta?.icon ? (
                <Image source={{uri: r.meta.icon}} style={styles.appIcon} />
              ) : (
                <View style={[styles.appIcon, styles.appIconFallback]}>
                  <Text style={styles.appIconFallbackText}>
                    {(r.meta?.appName ?? r.pkg).charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.appBody}>
                <View style={styles.appHeader}>
                  <Text style={styles.appName} numberOfLines={1}>
                    {r.meta?.appName ?? r.pkg}
                  </Text>
                  <Text style={styles.appTime}>{formatHm(r.mins)}</Text>
                </View>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      {width: `${Math.max(2, r.ratio * 100)}%`},
                    ]}
                  />
                </View>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function SelectedDayHeader({
  selectedDate,
  todayKey,
  totalMins,
  noData,
}: {
  selectedDate: string;
  todayKey: string;
  totalMins: number;
  noData: boolean;
}) {
  const isToday = selectedDate === todayKey;
  const subtitle = noData
    ? 'No data yet'
    : isToday
      ? "Today's screen time"
      : `${weekdayLong(selectedDate)}'s screen time`;
  return (
    <View style={styles.headerCard}>
      <Text style={styles.headerSubtitle}>{subtitle}</Text>
      <Text style={styles.headerValue}>{formatHm(totalMins) || '0m'}</Text>
    </View>
  );
}

function SummaryPill({label, value}: {label: string; value: string}) {
  return (
    <View style={styles.pill}>
      <Text style={styles.pillLabel}>{label}</Text>
      <Text style={styles.pillValue}>{value}</Text>
    </View>
  );
}

function formatHm(mins: number): string {
  if (!mins || mins < 1) {return '0m';}
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) {return `${m}m`;}
  if (m === 0) {return `${h}h`;}
  return `${h}h ${m}m`;
}

function weekdayLong(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(n => parseInt(n, 10));
  const dt = new Date(y, m - 1, d);
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][
    dt.getDay()
  ];
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    gap: spacing.md,
  },
  headerCard: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  headerSubtitle: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  headerValue: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  pill: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: 2,
  },
  pillLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  pillValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginTop: spacing.sm,
  },
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
  appList: {
    gap: spacing.sm,
  },
  appRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  appIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
  },
  appIconFallback: {
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appIconFallbackText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  appBody: {
    flex: 1,
    gap: 6,
  },
  appHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  appName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  appTime: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
});
