import React, {useEffect, useState} from 'react';
import {Image, StyleSheet, Switch, Text, View} from 'react-native';
import Svg, {Defs, LinearGradient, Rect, Stop} from 'react-native-svg';

import {colors, radius, softShadow, spacing, tileGradientFor} from '../../theme';
import {
  setAppBlocked,
  subscribeChildApps,
  subscribeChildDoc,
} from '@zerebro/shared-firebase/firestore';
import type {AppEntry, ChildDoc} from '@zerebro/shared-types';

/**
 * Apps list rendered inline inside `ChildDetailsScreen`'s outer `ScrollView`.
 *
 * Uses `View + .map()` rather than `FlatList` on purpose: a virtualised list nested inside
 * a `ScrollView` of the same orientation triggers a runtime warning and breaks both
 * virtualisation and scroll physics. A typical child's phone has well under a few hundred
 * apps, so the lost virtualisation is a fair trade for layout correctness.
 *
 * Three rendering states, driven by `ChildDoc.appsLastSyncedAt` so we can tell them apart:
 *   - never-synced (no device has opened KidSafe yet) -> instructional card.
 *   - synced + empty (child has zero installed apps, very unusual) -> "no apps" copy.
 *   - synced + non-empty -> the normal blockable list.
 */
/** 44px rounded gradient tile with the app's first letter — fallback when no icon synced. */
function GradientLetterTile({packageName, letter}: {packageName: string; letter: string}) {
  const pair = tileGradientFor(packageName);
  // Gradient id must be unique per tile, otherwise sibling SVGs resolve the same def.
  const id = `tile-${packageName.replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <View style={styles.tile}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={pair.from} />
            <Stop offset="1" stopColor={pair.to} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
      <Text style={styles.tileLetter}>{letter}</Text>
    </View>
  );
}

export function AppsTab({childUid}: {childUid: string}) {
  const [apps, setApps] = useState<AppEntry[]>([]);
  const [childDoc, setChildDoc] = useState<ChildDoc | null>(null);
  const [docLoaded, setDocLoaded] = useState(false);

  useEffect(() => subscribeChildApps(childUid, setApps), [childUid]);
  useEffect(
    () =>
      subscribeChildDoc(childUid, doc => {
        setChildDoc(doc);
        setDocLoaded(true);
      }),
    [childUid],
  );

  const neverSynced = docLoaded && !childDoc?.appsLastSyncedAt;

  if (neverSynced) {
    return (
      <View style={styles.container}>
        <View style={styles.waitingCard}>
          <Text style={styles.waitingTitle}>Waiting for your child's phone</Text>
          <Text style={styles.waitingBody}>
            Ask your child to open KidSafe on their phone at least once. As soon as they do,
            their installed apps will appear here and you can choose which ones to block.
          </Text>
        </View>
      </View>
    );
  }

  if (apps.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.empty}>
          Synced — but no apps were reported by the child's phone yet.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Installed Apps</Text>
        <Text style={styles.sectionCount}>
          {apps.length} {apps.length === 1 ? 'app' : 'apps'}
        </Text>
      </View>
      {apps.map(item => (
        <View key={item.packageName} style={styles.card}>
          {item.icon ? (
            <Image source={{uri: item.icon}} style={styles.icon} />
          ) : (
            <GradientLetterTile
              packageName={item.packageName}
              letter={item.appName.charAt(0).toUpperCase()}
            />
          )}
          <View style={styles.body}>
            <Text style={styles.name} numberOfLines={1}>
              {item.appName}
            </Text>
          </View>
          <Switch
            value={item.isBlocked}
            onValueChange={v => setAppBlocked(childUid, item.packageName, v)}
            trackColor={{true: colors.danger, false: colors.border}}
            thumbColor="#ffffff"
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.sm + 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  sectionCount: {
    color: colors.textMuted,
    fontSize: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg - 4,
    padding: spacing.md,
    gap: spacing.md - 4,
    ...softShadow,
  },
  body: {flex: 1, minWidth: 0},
  icon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
  },
  tile: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLetter: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  name: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  empty: {
    color: colors.textMuted,
    textAlign: 'center',
    padding: spacing.lg,
  },
  waitingCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg - 4,
    padding: spacing.lg,
    gap: spacing.sm,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    ...softShadow,
  },
  waitingTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  waitingBody: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
});
