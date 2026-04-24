import React, {useEffect, useState} from 'react';
import {FlatList, Image, StyleSheet, Switch, Text, View} from 'react-native';

import {colors, radius, spacing} from '../../theme';
import {setAppBlocked, subscribeChildApps} from '../../firebase/firestore';
import type {AppEntry} from '../../firebase/types';

export function AppsTab({childUid}: {childUid: string}) {
  const [apps, setApps] = useState<AppEntry[]>([]);

  useEffect(() => subscribeChildApps(childUid, setApps), [childUid]);

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={{padding: spacing.md}}
      ItemSeparatorComponent={() => <View style={{height: spacing.sm}} />}
      data={apps}
      keyExtractor={a => a.packageName}
      ListEmptyComponent={
        <Text style={styles.empty}>No apps synced yet. Open KidSafe on your child's phone.</Text>
      }
      renderItem={({item}) => (
        <View style={styles.row}>
          {item.icon ? (
            <Image source={{uri: item.icon}} style={styles.icon} />
          ) : (
            <View style={[styles.icon, styles.iconFallback]}>
              <Text style={styles.iconFallbackText}>{item.appName.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={{flex: 1}}>
            <Text style={styles.name}>{item.appName}</Text>
            <Text style={styles.pkg}>{item.packageName}</Text>
          </View>
          <Switch
            value={item.isBlocked}
            onValueChange={v => setAppBlocked(childUid, item.packageName, v)}
            trackColor={{true: colors.danger, false: colors.surfaceAlt}}
            thumbColor={colors.text}
          />
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    backgroundColor: colors.bg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.md,
  },
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
