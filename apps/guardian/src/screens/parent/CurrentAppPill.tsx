import React, {useEffect, useMemo, useState} from 'react';
import {Image, StyleSheet, Text, View} from 'react-native';
import Svg, {Path} from 'react-native-svg';

import {colors, gradients, radius, softShadow, spacing} from '../../theme';
import {subscribeChildApps, subscribeChildDoc} from '@zerebro/shared-firebase/firestore';
import type {AppEntry, ChildDoc, ChildForegroundApp} from '@zerebro/shared-types';

/**
 * Live "what is my child using right now" status card, rendered above the tabs on
 * `ChildDetailsScreen`. Reads `ChildDoc.currentApp` (written by the native
 * `KidSafeForegroundService` UsageStats resolver every ~1.5s, plus the JS coalesce path as a
 * fallback in-process writer) and joins the package name against the `apps` subcollection
 * for a friendly name + icon.
 *
 * Visual states:
 *   - foreground (real app)   → green dot, "Using {appName}"
 *   - foreground (launcher)   → defensive fallback to `lastNonLauncherPackage` if available,
 *                                otherwise "Phone idle" — we never show "Using Home screen"
 *                                or "Using XOS Launcher" anymore.
 *   - screen_off              → muted dot, "Phone idle"
 *   - unavailable             → warning dot, "Live activity unavailable" (accessibility off)
 *   - no data yet             → neutral, "Waiting for your child's phone"
 *
 * Staleness handling differs from the previous JS-only pipeline: the native writer keeps
 * `updatedAt` refreshed every ~25s while the device is in use, so we no longer flip to
 * "Last seen ..." after 60s — that branch existed because the JS heartbeat could die on
 * aggressive OEMs. If the doc IS truly stale (we explicitly hit `LONG_STALE_THRESHOLD_MS`
 * without a refresh), we show "Phone idle" to fail safe.
 *
 * The card spans the content width and ellipsizes long app names after "Using".
 */

/** Past this many ms without any update we assume the child device is genuinely offline. */
const LONG_STALE_THRESHOLD_MS = 5 * 60_000;

/**
 * Common Android launcher packages — kept here purely so we can recognise launcher payloads
 * coming over the wire and re-route them to the last real app or "Phone idle". The card
 * itself never renders a launcher name.
 */
const LAUNCHER_PREFIXES = [
  'com.android.launcher',
  'com.google.android.apps.nexuslauncher',
  'com.sec.android.app.launcher',
  'com.miui.home',
  'com.miui.launcher',
  'com.oppo.launcher',
  'com.bbk.launcher2',
  'com.realme.launcher',
  'com.oneplus.launcher',
  'net.oneplus.launcher',
  'com.transsion.xoslauncher',
  'com.transsion.launcher',
  'com.infinix.xlauncher',
];

function isLauncher(pkg: string): boolean {
  const normalized = pkg.toLowerCase();
  return LAUNCHER_PREFIXES.some(
    prefix => normalized === prefix || normalized.startsWith(prefix),
  );
}

type StateGlyph = 'moon' | 'warning' | 'phone';

interface PillView {
  /** Full label for muted / idle states. */
  label: string;
  /** When set, render "Using {appName}" with only the name ellipsized. */
  appName?: string;
  sublabel?: string;
  dotColor: string;
  iconUri?: string;
  iconFallback?: string;
  /** Glyph drawn in the circular container when there is no app icon to show. */
  glyph?: StateGlyph;
  muted: boolean;
}

function idleView(): PillView {
  return {
    label: 'Phone idle',
    sublabel: 'No activity detected',
    dotColor: colors.textMuted,
    glyph: 'moon',
    muted: true,
  };
}

function resolvePillView(
  current: ChildForegroundApp | undefined,
  appsByPkg: Map<string, AppEntry>,
  now: number,
): PillView {
  if (!current) {
    return {
      label: 'Waiting for your child\u2019s phone',
      sublabel: 'Ask them to open KidSafe once',
      dotColor: colors.textMuted,
      glyph: 'phone',
      muted: true,
    };
  }
  if (current.state === 'screen_off') {
    return idleView();
  }
  if (current.state === 'unavailable') {
    return {
      label: 'Live activity unavailable',
      sublabel: 'Accessibility is turned off',
      dotColor: colors.warning,
      glyph: 'warning',
      muted: true,
    };
  }

  const longStale = now - current.updatedAt > LONG_STALE_THRESHOLD_MS;
  if (longStale) {
    return idleView();
  }

  // Resolve the package we want to surface. Defensive: if for any reason the writer hands us
  // a launcher package, fall back to the cached last real app. The native writer already
  // does this internally, so the fallback only fires for JS-written docs and old data.
  const rawPkg = current.packageName ?? '';
  const pkg = rawPkg && !isLauncher(rawPkg)
    ? rawPkg
    : current.lastNonLauncherPackage ?? '';
  if (!pkg) {
    return idleView();
  }

  const entry = appsByPkg.get(pkg);
  const friendlyName = entry?.appName ?? pkg;

  return {
    label: '',
    appName: friendlyName,
    sublabel: 'Active now',
    dotColor: colors.success,
    iconUri: entry?.icon,
    iconFallback: friendlyName.charAt(0).toUpperCase(),
    muted: false,
  };
}

function StateGlyphIcon({glyph}: {glyph: StateGlyph}) {
  const stroke = colors.textMuted;
  if (glyph === 'moon') {
    return (
      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
        <Path
          d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.6 6.6 0 0 0 9.8 9.8Z"
          stroke={stroke}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    );
  }
  if (glyph === 'warning') {
    return (
      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
        <Path
          d="M10.3 4.1 2.6 17.4a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.1a2 2 0 0 0-3.4 0ZM12 9v4M12 17h.01"
          stroke={stroke}
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    );
  }
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2ZM11 18h2"
        stroke={stroke}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function CurrentAppPill({childUid}: {childUid: string}) {
  const [childDoc, setChildDoc] = useState<ChildDoc | null>(null);
  const [apps, setApps] = useState<AppEntry[]>([]);
  // Tick so stale detection re-renders even when no Firestore update arrives. Cheap — one
  // setState per second only while this component is mounted.
  const [, setTick] = useState(0);

  useEffect(() => subscribeChildDoc(childUid, setChildDoc), [childUid]);
  useEffect(() => subscribeChildApps(childUid, setApps), [childUid]);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1_000);
    return () => clearInterval(id);
  }, []);

  const appsByPkg = useMemo(
    () => new Map(apps.map(a => [a.packageName, a])),
    [apps],
  );
  const view = resolvePillView(childDoc?.currentApp, appsByPkg, Date.now());

  return (
    <View style={styles.card}>
      <View style={styles.iconWrap}>
        {view.iconUri ? (
          <Image source={{uri: view.iconUri}} style={styles.icon} />
        ) : view.glyph ? (
          <StateGlyphIcon glyph={view.glyph} />
        ) : (
          <Text style={styles.iconFallbackText}>{view.iconFallback}</Text>
        )}
      </View>
      <View style={styles.textWrap}>
        {view.appName ? (
          <View style={styles.labelRow}>
            <Text style={styles.label}>Using </Text>
            <Text
              style={[styles.label, styles.labelEllipsis]}
              numberOfLines={1}
              ellipsizeMode="tail">
              {view.appName}
            </Text>
          </View>
        ) : (
          <Text style={styles.label} numberOfLines={1} ellipsizeMode="tail">
            {view.label}
          </Text>
        )}
        {view.sublabel ? (
          <Text style={styles.sublabel} numberOfLines={1} ellipsizeMode="tail">
            {view.sublabel}
          </Text>
        ) : null}
      </View>
      <View style={[styles.dot, {backgroundColor: view.dotColor}]} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md - 4,
    backgroundColor: colors.surface,
    borderRadius: radius.lg - 4,
    padding: spacing.md,
    maxWidth: '100%',
    ...softShadow,
    shadowOpacity: 0.1,
    elevation: 3,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: gradients.iconCircle,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    overflow: 'hidden',
  },
  icon: {
    width: 28,
    height: 28,
    borderRadius: 6,
  },
  iconFallbackText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    flexShrink: 0,
    marginLeft: spacing.xs,
  },
  label: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '600',
  },
  textWrap: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  labelEllipsis: {
    flex: 1,
    minWidth: 0,
  },
  sublabel: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    flexShrink: 1,
  },
});
