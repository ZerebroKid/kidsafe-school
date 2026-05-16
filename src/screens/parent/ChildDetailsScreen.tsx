import React, {useEffect, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {colors, radius, spacing} from '../../theme';
import type {ParentStackParamList} from '../../navigation/types';
import {paths} from '../../firebase/firestore';
import {AppsTab} from './AppsTab';
import {CurrentAppPill} from './CurrentAppPill';
import {LocationTab} from './LocationTab';
import {PinTab} from './PinTab';
import {ScheduleTab} from './ScheduleTab';
import {UsageTab} from './UsageTab';
import {SafeAreaView} from 'react-native-safe-area-context';

type Props = NativeStackScreenProps<ParentStackParamList, 'ChildDetails'>;

type Tab = 'apps' | 'usage' | 'schedule' | 'location' | 'pin';

interface TamperEvent {
  id: string;
  kind: string;
  success: boolean;
  timestamp: number;
}

export function ChildDetailsScreen({route}: Props) {
  const {childUid, childName} = route.params;
  const [tab, setTab] = useState<Tab>('apps');
  const [tamperEvents, setTamperEvents] = useState<TamperEvent[]>([]);

  useEffect(() => {
    const unsub = paths
      .events(childUid)
      .where('type', '==', 'tamper_attempt')
      .orderBy('timestamp', 'desc')
      .limit(5)
      .onSnapshot(
        snap => {
          setTamperEvents(
            snap.docs.map(d => {
              const data = d.data() as Partial<TamperEvent>;
              return {
                id: d.id,
                kind: typeof data.kind === 'string' ? data.kind : 'unknown',
                success: data.success === true,
                timestamp: typeof data.timestamp === 'number' ? data.timestamp : 0,
              };
            }),
          );
        },
        err => console.warn('tamper events sub error', err),
      );
    return unsub;
  }, [childUid]);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {/* Sticky status strip — sits OUTSIDE the ScrollView so the live "Currently using"
          pill stays visible regardless of which tab is selected or how far the user has
          scrolled. Padding mirrors the inner content gutter so the pill aligns with cards. */}
      <View style={styles.statusStrip}>
        <CurrentAppPill childUid={childUid} />
      </View>
      <ScrollView contentContainerStyle={{paddingBottom: spacing.xl}}>
        <View style={styles.tabbar}>
          <TabButton label="Apps" active={tab === 'apps'} onPress={() => setTab('apps')} />
          <TabButton label="Usage" active={tab === 'usage'} onPress={() => setTab('usage')} />
          <TabButton
            label="Schedule"
            active={tab === 'schedule'}
            onPress={() => setTab('schedule')}
          />
          <TabButton
            label="Location"
            active={tab === 'location'}
            onPress={() => setTab('location')}
          />
          <TabButton label="PIN" active={tab === 'pin'} onPress={() => setTab('pin')} />
        </View>

        <TamperPanel events={tamperEvents} />

        <View style={{minHeight: 360}}>
          {tab === 'apps' && <AppsTab childUid={childUid} />}
          {tab === 'usage' && <UsageTab childUid={childUid} />}
          {tab === 'schedule' && <ScheduleTab childUid={childUid} />}
          {tab === 'location' && <LocationTab childUid={childUid} />}
          {tab === 'pin' && <PinTab childUid={childUid} childName={childName} />}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function TamperPanel({events}: {events: TamperEvent[]}) {
  if (events.length === 0) {
    return null;
  }
  return (
    <View style={styles.tamperCard}>
      <Text style={styles.tamperTitle}>Recent uninstall attempts</Text>
      {events.map(e => (
        <View key={e.id} style={styles.tamperRow}>
          <View
            style={[
              styles.tamperDot,
              {backgroundColor: e.success ? colors.warning : colors.danger},
            ]}
          />
          <View style={styles.tamperRowText}>
            <Text style={styles.tamperKind}>{labelForKind(e.kind)}</Text>
            <Text style={styles.tamperMeta}>
              {e.success ? 'Unlocked with PIN' : 'PIN gate blocked'} ·{' '}
              {formatRelative(e.timestamp)}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function labelForKind(kind: string): string {
  switch (kind) {
    case 'app_info':
      return 'Tried to open KidSafe App info';
    case 'device_admin':
      return 'Tried to disable device admin';
    case 'accessibility':
      return 'Tried to disable accessibility';
    case 'battery':
      return 'Tried to change battery settings';
    case 'autostart':
      return 'Tried to change autostart settings';
    default:
      return 'Tamper attempt';
  }
}

function formatRelative(ts: number): string {
  if (!ts) return '';
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} h ago`;
  return `${Math.floor(diff / 86_400_000)} d ago`;
}

function TabButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.tab, active && styles.tabActive]}>
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: colors.bg},
  statusStrip: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  tabbar: {
    flexDirection: 'row',
    margin: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    padding: 4,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: radius.pill,
  },
  tabActive: {backgroundColor: colors.primary},
  tabLabel: {color: colors.textMuted, fontWeight: '600', fontSize: 12},
  tabLabelActive: {color: colors.primaryText},
  tamperCard: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  tamperTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  tamperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  tamperRowText: {flex: 1},
  tamperDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  tamperKind: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  tamperMeta: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 1,
  },
});
