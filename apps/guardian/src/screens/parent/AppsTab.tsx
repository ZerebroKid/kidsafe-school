import React, {useEffect, useState} from 'react';
import {Image, StyleSheet, Switch, Text, View} from 'react-native';

import {colors, radius, spacing} from '../../theme';
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
      {apps.map(item => (
        <View key={item.packageName} style={styles.row}>
          {item.icon ? (
            <Image source={{uri: item.icon}} style={styles.icon} />
          ) : (
            <View style={[styles.icon, styles.iconFallback]}>
              <Text style={styles.iconFallbackText}>
                {item.appName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.body}>
            <Text style={styles.name} numberOfLines={1}>
              {item.appName}
            </Text>
            <Text style={styles.pkg} numberOfLines={1}>
              {item.packageName}
            </Text>
          </View>
          <Switch
            value={item.isBlocked}
            onValueChange={v => setAppBlocked(childUid, item.packageName, v)}
            trackColor={{true: colors.danger, false: colors.surfaceAlt}}
            thumbColor={colors.text}
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
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.md,
  },
  body: {flex: 1},
  icon: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  iconFallback: {
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconFallbackText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  name: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  pkg: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  empty: {
    color: colors.textMuted,
    textAlign: 'center',
    padding: spacing.lg,
  },
  waitingCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.sm,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
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
