import React, {useEffect, useState} from 'react';
import {Image, StyleSheet, Switch, Text, View} from 'react-native';

import {colors, radius, spacing} from '../../theme';
import {setAppBlocked, subscribeChildApps} from '../../firebase/firestore';
import type {AppEntry} from '../../firebase/types';

/**
 * Apps list rendered inline inside `ChildDetailsScreen`'s outer `ScrollView`.
 *
 * Uses `View + .map()` rather than `FlatList` on purpose: a virtualised list nested inside
 * a `ScrollView` of the same orientation triggers a runtime warning and breaks both
 * virtualisation and scroll physics. A typical child's phone has well under a few hundred
 * apps, so the lost virtualisation is a fair trade for layout correctness.
 */
export function AppsTab({childUid}: {childUid: string}) {
  const [apps, setApps] = useState<AppEntry[]>([]);

  useEffect(() => subscribeChildApps(childUid, setApps), [childUid]);

  if (apps.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.empty}>
          No apps synced yet. Open KidSafe on your child's phone.
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
});
