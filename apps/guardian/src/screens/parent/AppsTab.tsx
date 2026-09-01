import React, {useEffect, useState} from 'react';
import {Image, StyleSheet, Switch, Text, View} from 'react-native';
import Svg, {Defs, LinearGradient, Rect, Stop} from 'react-native-svg';

import {useParentTheme} from '../../state/themeStore';
import {parentRadius, parentSpacing} from './theme/parentTheme';
import {tileGradientFor} from '../../theme';
import {
  setAppBlocked,
  subscribeChildApps,
  subscribeChildDoc,
} from '@zerebro/shared-firebase/firestore';
import type {AppEntry, ChildDoc} from '@zerebro/shared-types';

function GradientLetterTile({packageName, letter}: {packageName: string; letter: string}) {
  const pair = tileGradientFor(packageName);
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

import {CosmicAssets} from '../../assets/cosmic';

function getFallbackAppIcon(appName: string) {
  const lower = appName.toLowerCase();
  if (lower.includes('youtube')) return CosmicAssets.aYoutube;
  if (lower.includes('photo')) return CosmicAssets.aPhotos;
  if (lower.includes('quiz') || lower.includes('study') || lower.includes('kidsafe') || lower.includes('zerebro')) return CosmicAssets.aQuiz;
  return null;
}

export function AppsTab({childUid}: {childUid: string}) {
  const {theme, isDark} = useParentTheme();
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
        <View
          style={[
            styles.waitingCard,
            {
              backgroundColor: isDark
                ? 'rgba(23, 19, 79, 0.88)'
                : theme.cardBg,
              borderColor: theme.cardBorder,
              borderLeftColor: theme.primary,
            },
          ]}>
          <Text style={[styles.waitingTitle, {color: theme.text}]}>
            Waiting for your child's phone
          </Text>
          <Text style={[styles.waitingBody, {color: theme.textMuted}]}>
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
        <Text style={[styles.empty, {color: theme.textMuted}]}>
          Synced — but no apps were reported by the child's phone yet.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Image
        source={CosmicAssets.tApps}
        style={styles.heroBannerImg}
        resizeMode="cover"
      />
      <View style={styles.sectionHeader}>
        <Text
          style={[
            styles.sectionTitle,
            {color: isDark ? '#C4B5FD' : theme.textSubtle},
          ]}>
          Installed Apps
        </Text>
        <Text style={[styles.sectionCount, {color: theme.textMuted}]}>
          {apps.length} {apps.length === 1 ? 'app' : 'apps'}
        </Text>
      </View>
      {apps.map(item => {
        const fallbackIcon = getFallbackAppIcon(item.appName);
        return (
          <View
            key={item.packageName}
            style={[
              styles.card,
              {
                backgroundColor: isDark
                  ? 'rgba(23, 19, 79, 0.88)'
                  : theme.cardBg,
                borderColor: theme.cardBorder,
              },
            ]}>
            {item.icon ? (
              <Image source={{uri: item.icon}} style={styles.icon} />
            ) : fallbackIcon ? (
              <Image source={fallbackIcon} style={styles.icon} resizeMode="contain" />
            ) : (
              <GradientLetterTile
                packageName={item.packageName}
                letter={item.appName.charAt(0).toUpperCase()}
              />
            )}
            <View style={styles.body}>
              <Text
                style={[styles.name, {color: theme.text}]}
                numberOfLines={1}>
                {item.appName}
              </Text>
            </View>
            <Switch
              value={item.isBlocked}
              onValueChange={v => setAppBlocked(childUid, item.packageName, v)}
              trackColor={{
                true: theme.danger,
                false: isDark ? 'rgba(255, 255, 255, 0.2)' : '#EADFDA',
              }}
              thumbColor="#ffffff"
            />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: parentSpacing.lg,
    paddingBottom: parentSpacing.lg,
    gap: parentSpacing.sm + 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: parentSpacing.xs,
    marginBottom: parentSpacing.xs,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  sectionCount: {
    fontSize: 12,
    fontWeight: '600',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: parentRadius.lg,
    padding: parentSpacing.md,
    gap: 12,
    borderWidth: 1,
  },
  body: {flex: 1, minWidth: 0},
  icon: {
    width: 44,
    height: 44,
    borderRadius: 14,
  },
  tile: {
    width: 44,
    height: 44,
    borderRadius: 14,
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
    fontSize: 15,
    fontWeight: '600',
  },
  empty: {
    textAlign: 'center',
    padding: parentSpacing.lg,
    fontSize: 14,
  },
  waitingCard: {
    borderRadius: parentRadius.lg,
    padding: parentSpacing.lg,
    gap: parentSpacing.sm,
    borderLeftWidth: 4,
    borderWidth: 1,
  },
  waitingTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  waitingBody: {
    fontSize: 13,
    lineHeight: 18,
  },
  heroBannerImg: {
    width: '100%',
    height: 140,
    borderRadius: 22,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.24)',
  },
});
