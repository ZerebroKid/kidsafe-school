import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import Svg, {Circle, Line, Rect, Text as SvgText} from 'react-native-svg';

import {colors, radius, spacing} from '../../theme';

/**
 * P4.11.3 -- aggregated metrics for the teacher class report visuals.
 * Derived entirely client-side from the per-student `rows` already computed in
 * `ClassReportScreen` (each student contributes their latest attempt).
 */
export interface ClassMetrics {
  total: number;
  attempted: number;
  notAttempted: number;
  passed: number;
  failed: number;
  /** Mean `lastPercentage` over attempted students; null when none attempted. */
  avg: number | null;
  /** Counts in score buckets [0-20, 21-40, 41-60, 61-80, 81-100]. */
  buckets: number[];
}

const BUCKET_LABELS = ['0-20', '21-40', '41-60', '61-80', '81-100'];

/**
 * Visual summary for the class report: three stat cards + a pass/fail/
 * not-attempted donut + a score-distribution histogram. Pure react-native-svg
 * (mirrors `UsageBarChart`); display-only, no interaction.
 */
export function ClassReportCharts({metrics}: {metrics: ClassMetrics}) {
  return (
    <View style={styles.wrap}>
      <StatCards metrics={metrics} />
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Outcome breakdown</Text>
        <PassDonut metrics={metrics} />
      </View>
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Score distribution</Text>
        <ScoreHistogram buckets={metrics.buckets} />
      </View>
    </View>
  );
}

function StatCards({metrics}: {metrics: ClassMetrics}) {
  return (
    <View style={styles.statsRow}>
      <View style={styles.statCard}>
        <Text style={styles.statValue}>
          {metrics.avg === null ? '—' : `${metrics.avg}%`}
        </Text>
        <Text style={styles.statLabel}>Avg score</Text>
      </View>
      <View style={styles.statCard}>
        <Text style={styles.statValue}>
          {metrics.attempted}/{metrics.total}
        </Text>
        <Text style={styles.statLabel}>Attempted</Text>
      </View>
      <View style={styles.statCard}>
        <Text style={[styles.statValue, {color: colors.success}]}>
          {metrics.passed}
        </Text>
        <Text style={styles.statLabel}>Passed</Text>
      </View>
    </View>
  );
}

interface Segment {
  key: string;
  label: string;
  value: number;
  color: string;
}

function PassDonut({metrics}: {metrics: ClassMetrics}) {
  const segments: Segment[] = [
    {key: 'passed', label: 'Passed', value: metrics.passed, color: colors.success},
    {key: 'failed', label: 'Keep going', value: metrics.failed, color: colors.warning},
    {
      key: 'notAttempted',
      label: 'Not attempted',
      value: metrics.notAttempted,
      color: colors.surfaceAlt,
    },
  ];

  const size = 140;
  const stroke = 18;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const denom = metrics.total > 0 ? metrics.total : 1;

  // Walk segments, accumulating offset around the ring. strokeDashoffset is
  // negative so segments advance clockwise from 12 o'clock (rotate -90).
  let acc = 0;

  return (
    <View style={styles.donutRow}>
      {/* Ring drawn in SVG; center text overlaid as real RN <Text> so it
          centers reliably via flexbox (SVG textAnchor="middle" mis-positions
          on some Android react-native-svg builds). */}
      <View style={{width: size, height: size}}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Track so an empty/partial ring still reads as a circle. */}
          <Circle
            cx={cx}
            cy={cy}
            r={r}
            stroke={colors.bg}
            strokeWidth={stroke}
            fill="none"
          />
          {segments.map(seg => {
            if (seg.value <= 0) return null;
            const frac = seg.value / denom;
            const dash = frac * circumference;
            const dashArray = `${dash} ${circumference - dash}`;
            const dashOffset = -acc * circumference;
            acc += frac;
            return (
              <Circle
                key={seg.key}
                cx={cx}
                cy={cy}
                r={r}
                stroke={seg.color}
                strokeWidth={stroke}
                fill="none"
                strokeDasharray={dashArray}
                strokeDashoffset={dashOffset}
                strokeLinecap="butt"
                transform={`rotate(-90 ${cx} ${cy})`}
              />
            );
          })}
        </Svg>
        <View style={styles.donutCenter} pointerEvents="none">
          <Text style={styles.donutCenterValue}>
            {metrics.passed}/{metrics.total}
          </Text>
          <Text style={styles.donutCenterLabel}>passed</Text>
        </View>
      </View>

      <View style={styles.legend}>
        {segments.map(seg => (
          <View key={seg.key} style={styles.legendRow}>
            <View style={[styles.legendDot, {backgroundColor: seg.color}]} />
            <Text style={styles.legendLabel}>{seg.label}</Text>
            <Text style={styles.legendValue}>{seg.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function ScoreHistogram({buckets}: {buckets: number[]}) {
  const yMax = Math.max(1, ...buckets);

  const W = 320;
  const H = 180;
  const padTop = 12;
  const padBottom = 28;
  const padLeft = 24;
  const padRight = 8;
  const chartW = W - padLeft - padRight;
  const chartH = H - padTop - padBottom;
  const slotW = chartW / buckets.length;
  const barW = Math.min(40, slotW / 1.5);

  const ticks = [0, yMax / 2, yMax];

  return (
    <Svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height={H}
      preserveAspectRatio="none">
      {ticks.map((t, i) => {
        const y = padTop + chartH - (t / yMax) * chartH;
        return (
          <Line
            key={`g${i}`}
            x1={padLeft}
            x2={W - padRight}
            y1={y}
            y2={y}
            stroke={colors.border}
            strokeWidth={1}
            strokeDasharray={i === 0 ? undefined : '3,4'}
          />
        );
      })}

      {ticks.map((t, i) => {
        const y = padTop + chartH - (t / yMax) * chartH;
        return (
          <SvgText
            key={`yl${i}`}
            x={padLeft - 6}
            y={y + 3}
            fontSize={9}
            fill={colors.textMuted}
            textAnchor="end">
            {Math.round(t)}
          </SvgText>
        );
      })}

      {buckets.map((count, i) => {
        const cx = padLeft + slotW * i + slotW / 2;
        const x = cx - barW / 2;
        const h = count === 0 ? 0 : Math.max(2, (count / yMax) * chartH);
        const y = padTop + chartH - h;
        return (
          <Rect
            key={`b${i}`}
            x={x}
            y={y}
            width={barW}
            height={h}
            rx={4}
            ry={4}
            fill={colors.primary}
            opacity={count === 0 ? 0.4 : 1}
          />
        );
      })}

      {buckets.map((_, i) => {
        const cx = padLeft + slotW * i + slotW / 2;
        return (
          <SvgText
            key={`xl${i}`}
            x={cx}
            y={H - 8}
            fontSize={9}
            fill={colors.textMuted}
            textAnchor="middle">
            {BUCKET_LABELS[i]}
          </SvgText>
        );
      })}
    </Svg>
  );
}

const styles = StyleSheet.create({
  wrap: {gap: spacing.md},
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
  chartCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  chartTitle: {color: colors.text, fontSize: 14, fontWeight: '600'},
  donutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  donutCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutCenterValue: {color: colors.text, fontSize: 24, fontWeight: '700'},
  donutCenterLabel: {color: colors.textMuted, fontSize: 11, marginTop: 1},
  legend: {flex: 1, gap: spacing.xs},
  legendRow: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm},
  legendDot: {width: 10, height: 10, borderRadius: 5},
  legendLabel: {flex: 1, color: colors.textMuted, fontSize: 12},
  legendValue: {color: colors.text, fontSize: 13, fontWeight: '600'},
});
