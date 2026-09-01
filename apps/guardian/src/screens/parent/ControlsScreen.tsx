import React, {useEffect, useMemo, useState} from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {SafeAreaView} from 'react-native-safe-area-context';

import {
  subscribeChildDoc,
  subscribeLinkedChildren,
} from '@zerebro/shared-firebase/firestore';
import {useAuthStore} from '../../state/authStore';
import {useParentTheme} from '../../state/themeStore';
import type {ChildDoc, UserDoc} from '@zerebro/shared-types';
import type {ParentStackParamList} from '../../navigation/types';
import {CosmicAssets} from '../../assets/cosmic';

type ChildRow = UserDoc & {uid: string; doc: ChildDoc | null};

export function ControlsScreen({route}: {route?: {params?: {childUid?: string; childName?: string}}}) {
  const paramChildUid = route?.params?.childUid;
  const navigation = useNavigation<NativeStackNavigationProp<ParentStackParamList>>();
  const parentUid = useAuthStore(s => s.firebaseUid);
  const {theme, isDark} = useParentTheme();

  const [rows, setRows] = useState<ChildRow[]>([]);
  const [selectedChildUid, setSelectedChildUid] = useState<string | null>(paramChildUid ?? null);

  useEffect(() => {
    if (paramChildUid) {
      setSelectedChildUid(paramChildUid);
    }
  }, [paramChildUid]);

  useEffect(() => {
    if (!parentUid) return;
    const subs: Array<() => void> = [];
    const unsub = subscribeLinkedChildren(parentUid, list => {
      setRows(list.map(u => ({...u, doc: null})));
      subs.forEach(u => u());
      subs.length = 0;
      list.forEach(u => {
        const us = subscribeChildDoc(u.uid, doc => {
          setRows(prev => prev.map(r => (r.uid === u.uid ? {...r, doc} : r)));
        });
        subs.push(us);
      });
    });
    return () => {
      unsub();
      subs.forEach(u => u());
    };
  }, [parentUid]);

  const activeChild = useMemo(() => {
    if (selectedChildUid) {
      const found = rows.find(r => r.uid === selectedChildUid);
      if (found) return found;
    }
    return rows[0] ?? null;
  }, [rows, selectedChildUid]);

  const activeName =
    activeChild?.name ?? activeChild?.displayName ?? 'Aalya';
  const isOnline = activeChild?.doc?.status === 'online';
  const isLocked = activeChild?.doc?.lockState?.locked ?? false;

  const controlFeatures = [
    {
      key: 'schedule',
      title: 'Schedule / Study time',
      subtitle: 'On · 3–6 PM, Mon–Fri\n4 apps stay allowed',
      image: CosmicAssets.tSchedule,
      borderColor: 'rgba(168,85,247,0.3)',
      onPress: () =>
        activeChild
          ? navigation.navigate('Schedule', {childUid: activeChild.uid, childName: activeName})
          : navigation.navigate('Settings'),
    },
    {
      key: 'location',
      title: 'Location',
      subtitle: isOnline ? 'At home · updated 2 min ago' : 'Paused — phone offline',
      image: CosmicAssets.tLocation,
      borderColor: 'rgba(53,217,255,0.3)',
      onPress: () =>
        activeChild
          ? navigation.navigate('Location', {childUid: activeChild.uid, childName: activeName})
          : navigation.navigate('Settings'),
    },
    {
      key: 'study',
      title: 'Study / Academic progress',
      subtitle: '6 subjects · quiz average 78%',
      image: CosmicAssets.tStudy,
      borderColor: 'rgba(85,217,139,0.3)',
      onPress: () =>
        activeChild
          ? navigation.navigate('Study', {childUid: activeChild.uid, childName: activeName})
          : navigation.navigate('Settings'),
    },
    {
      key: 'reels',
      title: 'Reels & videos',
      subtitle: '40 min a day · off during study',
      image: CosmicAssets.tReels,
      borderColor: 'rgba(233,92,255,0.3)',
      onPress: () =>
        activeChild
          ? navigation.navigate('ReelsInsights', {childUid: activeChild.uid, childName: activeName})
          : navigation.navigate('Settings'),
    },
    {
      key: 'apps',
      title: 'Apps & blocking',
      subtitle: '18 allowed · 6 blocked',
      image: CosmicAssets.tApps,
      borderColor: 'rgba(168,85,247,0.3)',
      onPress: () =>
        activeChild
          ? navigation.navigate('Apps', {childUid: activeChild.uid, childName: activeName})
          : navigation.navigate('Settings'),
    },
    {
      key: 'pin',
      title: 'Security / PIN',
      subtitle: 'On · last unlock 33 days ago',
      image: CosmicAssets.tSecurity,
      borderColor: 'rgba(53,217,255,0.3)',
      onPress: () =>
        activeChild
          ? navigation.navigate('Pin', {childUid: activeChild.uid, childName: activeName})
          : navigation.navigate('Settings'),
    },
    {
      key: 'device',
      title: 'Phone & device',
      subtitle: `${isLocked ? 'Locked' : 'Unlocked'} · 78% battery · synced`,
      image: CosmicAssets.tDevice,
      borderColor: 'rgba(85,217,139,0.3)',
      onPress: () =>
        activeChild
          ? navigation.navigate('ChildDetails', {childUid: activeChild.uid, childName: activeName})
          : navigation.navigate('Settings'),
    },
  ];

  return (
    <View style={[styles.root, {backgroundColor: theme.bg}]}>
      <StatusBar
        barStyle={theme.statusBar}
        backgroundColor="transparent"
        translucent
      />

      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <View style={styles.headerContentRow}>
          <View style={styles.headerTextCol}>
            <Text style={[styles.headerMainTitle, {color: theme.text}]}>
              Controls
            </Text>
            <Text style={[styles.headerSubtitle, {color: theme.textSubtle}]}>
              Everything you can manage for {activeName}
            </Text>
          </View>

          <View style={[styles.avatarBorderGlow, !isDark && {backgroundColor: '#F7C9D5'}]}>
            <Image
              source={isDark ? CosmicAssets.avatarChild : CosmicAssets.avatarAalya}
              style={[styles.headerAvatar, {borderColor: theme.surface}]}
            />
          </View>
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.cardsList}>
          {controlFeatures.map(item => (
            <Pressable
              key={item.key}
              style={[
                styles.featureCard,
                {
                  backgroundColor: theme.cardBg,
                  borderColor: theme.cardBorder,
                },
              ]}
              onPress={item.onPress}>
              <Image
                source={item.image}
                style={[styles.cardThumbImg, {borderColor: item.borderColor}]}
                resizeMode="cover"
              />
              <View style={styles.cardTextCol}>
                <Text style={[styles.cardTitle, {color: theme.text}]}>
                  {item.title}
                </Text>
                <Text style={[styles.cardSub, {color: theme.textSubtle}]}>
                  {item.subtitle}
                </Text>
              </View>
              <Text style={[styles.chevron, {color: theme.textSubtle}]}>›</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  headerSafe: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
  },
  headerContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTextCol: {
    flex: 1,
    gap: 4,
  },
  headerMainTitle: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  headerSubtitle: {
    fontSize: 13,
    fontWeight: '500',
  },
  avatarBorderGlow: {
    padding: 2,
    borderRadius: 999,
    backgroundColor: '#A855F7',
  },
  headerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingBottom: 110,
    paddingTop: 6,
  },
  cardsList: {
    gap: 12,
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 24,
    borderWidth: 1,
    gap: 14,
  },
  cardThumbImg: {
    width: 104,
    height: 80,
    borderRadius: 16,
    borderWidth: 1,
  },
  cardTextCol: {
    flex: 1,
    gap: 5,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  cardSub: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  chevron: {
    fontSize: 22,
    fontWeight: '400',
    paddingRight: 4,
  },
});
