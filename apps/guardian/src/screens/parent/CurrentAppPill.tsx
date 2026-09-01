import React, {useEffect, useMemo, useState} from 'react';
import {Image, StyleSheet, Text, View} from 'react-native';
import Svg, {Path} from 'react-native-svg';

import {useParentTheme} from '../../state/themeStore';
import {parentRadius, parentSpacing} from './theme/parentTheme';
import {subscribeChildApps, subscribeChildDoc} from '@zerebro/shared-firebase/firestore';
import type {AppEntry, ChildDoc, ChildForegroundApp} from '@zerebro/shared-types';

const LONG_STALE_THRESHOLD_MS = 5 * 60_000;

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
  label: string;
  appName?: string;
  sublabel?: string;
  dotColor: string;
  iconUri?: string;
  iconFallback?: string;
  glyph?: StateGlyph;
  muted: boolean;
}

function idleView(textMuted: string): PillView {
  return {
    label: 'Phone idle',
    sublabel: 'No activity detected',
    dotColor: textMuted,
    glyph: 'moon',
    muted: true,
  };
}

function resolvePillView(
  current: ChildForegroundApp | undefined,
  appsByPkg: Map<string, AppEntry>,
  now: number,
  colors: {textMuted: string; warning: string; success: string},
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
    return idleView(colors.textMuted);
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
    return idleView(colors.textMuted);
  }

  const rawPkg = current.packageName ?? '';
  const pkg =
    rawPkg && !isLauncher(rawPkg)
      ? rawPkg
      : current.lastNonLauncherPackage ?? '';
  if (!pkg) {
    return idleView(colors.textMuted);
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

function StateGlyphIcon({glyph, stroke}: {glyph: StateGlyph; stroke: string}) {
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
  const {theme, isDark} = useParentTheme();
  const [childDoc, setChildDoc] = useState<ChildDoc | null>(null);
  const [apps, setApps] = useState<AppEntry[]>([]);
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
  const view = resolvePillView(childDoc?.currentApp, appsByPkg, Date.now(), {
    textMuted: theme.textMuted,
    warning: theme.warning,
    success: theme.successGreen,
  });

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: isDark
            ? 'rgba(23, 19, 79, 0.95)'
            : theme.cardBg,
          borderColor: theme.cardBorder,
        },
      ]}>
      <View
        style={[
          styles.iconWrap,
          {
            backgroundColor: isDark
              ? 'rgba(109, 63, 231, 0.25)'
              : '#EFE7F8',
          },
        ]}>
        {view.iconUri ? (
          <Image source={{uri: view.iconUri}} style={styles.icon} />
        ) : view.glyph ? (
          <StateGlyphIcon glyph={view.glyph} stroke={theme.textMuted} />
        ) : (
          <Text style={[styles.iconFallbackText, {color: theme.text}]}>
            {view.iconFallback}
          </Text>
        )}
      </View>
      <View style={styles.textWrap}>
        {view.appName ? (
          <View style={styles.labelRow}>
            <Text style={[styles.label, {color: theme.text}]}>Using </Text>
            <Text
              style={[
                styles.label,
                styles.labelEllipsis,
                {color: theme.text},
              ]}
              numberOfLines={1}
              ellipsizeMode="tail">
              {view.appName}
            </Text>
          </View>
        ) : (
          <Text
            style={[styles.label, {color: theme.text}]}
            numberOfLines={1}
            ellipsizeMode="tail">
            {view.label}
          </Text>
        )}
        {view.sublabel ? (
          <Text
            style={[styles.sublabel, {color: theme.textMuted}]}
            numberOfLines={1}
            ellipsizeMode="tail">
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
    gap: 12,
    borderRadius: parentRadius.xl,
    borderWidth: 1,
    padding: 14,
    maxWidth: '100%',
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
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
    fontSize: 16,
    fontWeight: '700',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    flexShrink: 0,
    marginLeft: 4,
  },
  label: {
    fontSize: 15,
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
    fontSize: 12,
    fontWeight: '500',
    flexShrink: 1,
  },
});
