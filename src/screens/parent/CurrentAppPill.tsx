import React, {useEffect, useMemo, useState} from 'react';
import {Image, StyleSheet, Text, View} from 'react-native';

import {colors, radius, spacing} from '../../theme';
import {subscribeChildApps, subscribeChildDoc} from '../../firebase/firestore';
import type {AppEntry, ChildDoc, ChildForegroundApp} from '../../firebase/types';

/**
 * Live "what is my child using right now" pill, rendered above the tabs on
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
 * The pill hugs its content (`alignSelf: 'flex-start'`) so it doesn't dominate the header.
 */

/** Past this many ms without any update we assume the child device is genuinely offline. */
const LONG_STALE_THRESHOLD_MS = 5 * 60_000;

/**
 * Common Android launcher packages — kept here purely so we can recognise launcher payloads
 * coming over the wire and re-route them to the last real app or "Phone idle". The pill
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

interface PillView {
  label: string;
  sublabel?: string;
  dotColor: string;
  iconUri?: string;
  iconFallback?: string;
  muted: boolean;
}

function resolvePillView(
  current: ChildForegroundApp | undefined,
  appsByPkg: Map<string, AppEntry>,
  now: number,
): PillView {
  if (!current) {
    return {
      label: 'Waiting for your child\u2019s phone',
      dotColor: colors.textMuted,
      muted: true,
    };
  }
  if (current.state === 'screen_off') {
    return {label: 'Phone idle', dotColor: colors.textMuted, muted: true};
  }
  if (current.state === 'unavailable') {
    return {
      label: 'Live activity unavailable',
      dotColor: colors.warning,
      muted: true,
    };
  }

  const longStale = now - current.updatedAt > LONG_STALE_THRESHOLD_MS;
  if (longStale) {
    return {label: 'Phone idle', dotColor: colors.textMuted, muted: true};
  }

  // Resolve the package we want to surface. Defensive: if for any reason the writer hands us
  // a launcher package, fall back to the cached last real app. The native writer already
  // does this internally, so the fallback only fires for JS-written docs and old data.
  const rawPkg = current.packageName ?? '';
  const pkg = rawPkg && !isLauncher(rawPkg)
    ? rawPkg
    : current.lastNonLauncherPackage ?? '';
  if (!pkg) {
    return {label: 'Phone idle', dotColor: colors.textMuted, muted: true};
  }

  const entry = appsByPkg.get(pkg);
  const friendlyName = entry?.appName ?? pkg;

  return {
    label: `Using ${friendlyName}`,
    dotColor: colors.success,
    iconUri: entry?.icon,
    iconFallback: friendlyName.charAt(0).toUpperCase(),
    muted: false,
  };
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
    <View style={[styles.pill, view.muted && styles.pillMuted]}>
      <View style={[styles.dot, {backgroundColor: view.dotColor}]} />
      {view.iconUri ? (
        <Image source={{uri: view.iconUri}} style={styles.icon} />
      ) : view.iconFallback ? (
        <View style={[styles.icon, styles.iconFallback]}>
          <Text style={styles.iconFallbackText}>{view.iconFallback}</Text>
        </View>
      ) : null}
      <View style={styles.textWrap}>
        <Text
          style={[styles.label, view.muted && styles.labelMuted]}
          numberOfLines={1}>
          {view.label}
        </Text>
        {view.sublabel ? (
          <Text style={styles.sublabel} numberOfLines={1}>
            {view.sublabel}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm + 2,
    maxWidth: '100%',
  },
  pillMuted: {
    backgroundColor: colors.surface,
    opacity: 0.85,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  icon: {
    width: 18,
    height: 18,
    borderRadius: 4,
  },
  iconFallback: {
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconFallbackText: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '700',
  },
  label: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  labelMuted: {
    color: colors.textMuted,
    fontWeight: '500',
  },
  textWrap: {
    flexShrink: 1,
    gap: 2,
  },
  sublabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '500',
    flexShrink: 1,
  },
});
