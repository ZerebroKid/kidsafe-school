import React, {useMemo} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import Svg, {Line, Rect, Text as SvgText} from 'react-native-svg';

import {colors, radius, spacing} from '../../theme';

export interface ChartDay {
  /** `YYYY-MM-DD` — used as the stable key. */
  date: string;
  /** Total foreground minutes for that day. May be 0 (no usage / empty doc). */
  totalMins: number;
  /** True for the day that represents "now" on the parent device. */
  isToday: boolean;
}

interface Props {
  days: ChartDay[];
  selectedDate: string;
  onSelect: (date: string) => void;
}

/**
 * Pure-SVG weekly bar chart. Designed to be theme-consistent (dark navy + sky blue + lime
 * accent for today) and accessible (each bar has a 44dp tap target despite the visible bar
 * being narrower).
 *
 * Y-axis auto-scales to round up to the nearest 30 minutes (or 1 hour past 2h) so the
 * gridlines stay sensible across very different usage levels — a 12-minute day and an
 * 8-hour day both look right.
 */
export function UsageBarChart({days, selectedDate, onSelect}: Props) {
  const yMax = useMemo(() => {
    const peak = Math.max(0, ...days.map(d => d.totalMins));
    if (peak === 0) {return 60;} // all-zero week — render an empty 1-hour scale
    if (peak <= 60) {return Math.ceil(peak / 30) * 30;} // 30-min granularity below 1h
    if (peak <= 240) {return Math.ceil(peak / 60) * 60;} // 1-hour granularity below 4h
    return Math.ceil(peak / 120) * 120;                  // 2-hour granularity above
  }, [days]);

  const ticks = useMemo(() => [0, yMax / 2, yMax], [yMax]);

  // Layout constants. The SVG itself is intentionally sized in viewBox units; we let
  // `preserveAspectRatio="none"` stretch it to fill the parent container width.
  const W = 320;
  const H = 180;
  const padTop = 12;
  const padBottom = 28; // room for the day labels
  const padLeft = 32;
  const padRight = 8;
  const chartW = W - padLeft - padRight;
  const chartH = H - padTop - padBottom;
  const barW = Math.min(28, chartW / days.length / 1.6);

  return (
    <View style={styles.wrap}>
      <Svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        preserveAspectRatio="none">
        {/* Horizontal gridlines */}
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

        {/* Y-axis tick labels */}
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
              {formatAxisMins(t)}
            </SvgText>
          );
        })}

        {/* Bars */}
        {days.map((d, i) => {
          // Bars are evenly distributed across `chartW`. Center each bar inside its slot.
          const slotW = chartW / days.length;
          const cx = padLeft + slotW * i + slotW / 2;
          const x = cx - barW / 2;
          const h = yMax === 0 ? 0 : Math.max(2, (d.totalMins / yMax) * chartH);
          const y = padTop + chartH - h;
          const isSelected = d.date === selectedDate;
          const fill = isSelected
            ? colors.success
            : d.isToday
              ? colors.primary
              : colors.surfaceAlt;
          return (
            <Rect
              key={d.date}
              x={x}
              y={y}
              width={barW}
              height={h}
              rx={4}
              ry={4}
              fill={fill}
              opacity={d.totalMins === 0 && !isSelected ? 0.5 : 1}
            />
          );
        })}

        {/* X-axis day labels */}
        {days.map((d, i) => {
          const slotW = chartW / days.length;
          const cx = padLeft + slotW * i + slotW / 2;
          const isSelected = d.date === selectedDate;
          return (
            <SvgText
              key={`xl${d.date}`}
              x={cx}
              y={H - 8}
              fontSize={10}
              fill={isSelected ? colors.text : colors.textMuted}
              fontWeight={isSelected ? '700' : '400'}
              textAnchor="middle">
              {dayLetter(d.date)}
            </SvgText>
          );
        })}
      </Svg>

      {/* Tap-target overlay sitting on top of the SVG. We don't put Pressables inside the
          SVG because react-native-svg's onPress reliability varies by RN version. */}
      <View style={styles.overlay} pointerEvents="box-none">
        {days.map(d => (
          <Pressable
            key={`tap-${d.date}`}
            onPress={() => onSelect(d.date)}
            style={styles.tapTarget}
            hitSlop={6}
          />
        ))}
      </View>
    </View>
  );
}

function dayLetter(dateKey: string): string {
  // dateKey = 'YYYY-MM-DD'. Build the date in local time to match the labels we'd expect
  // ("Mon" for what's locally Monday). Using the constructor with a date string would
  // get parsed as UTC midnight which can shift the displayed weekday across timezones.
  const [y, m, day] = dateKey.split('-').map(n => parseInt(n, 10));
  const d = new Date(y, m - 1, day);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
}

function formatAxisMins(mins: number): string {
  if (mins < 60) {return `${Math.round(mins)}m`;}
  const h = mins / 60;
  return Number.isInteger(h) ? `${h}h` : `${h.toFixed(1)}h`;
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.md,
    position: 'relative',
  },
  overlay: {
    position: 'absolute',
    top: spacing.md,
    bottom: spacing.md,
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
  },
  tapTarget: {
    flex: 1,
  },
});

// Keep this so callers can ignore the import if they only want types.
export const __chartUtils = {dayLetter, formatAxisMins};
