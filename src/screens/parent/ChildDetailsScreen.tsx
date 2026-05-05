import React, {useEffect, useState} from 'react';
import {Alert, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {colors, radius, spacing} from '../../theme';
import type {ParentStackParamList} from '../../navigation/types';
import {paths, requestPinReset} from '../../firebase/firestore';
import {AppsTab} from './AppsTab';
import {LocationTab} from './LocationTab';
import {ContactsTab} from './ContactsTab';
import {SafeAreaView} from 'react-native-safe-area-context';

type Props = NativeStackScreenProps<ParentStackParamList, 'ChildDetails'>;

type Tab = 'apps' | 'location' | 'contacts';

interface TamperEvent {
  id: string;
  kind: string;
  success: boolean;
  timestamp: number;
}

export function ChildDetailsScreen({navigation, route}: Props) {
  const {childUid, childName} = route.params;
  const [tab, setTab] = useState<Tab>('apps');
  const [tamperEvents, setTamperEvents] = useState<TamperEvent[]>([]);
  const [resetting, setResetting] = useState(false);

  // Subscribe to the most recent tamper attempts so the parent can see what's been happening on
  // the child's phone. We pull the last 5 — anything older lives only in the audit log.
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

  function confirmResetPin() {
    Alert.alert(
      'Reset parent PIN?',
      `${childName}'s phone will be asked to set a new PIN the next time the app is opened. Use this only if you forgot the PIN.`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Reset PIN',
          style: 'destructive',
          onPress: async () => {
            setResetting(true);
            try {
              await requestPinReset(childUid);
              Alert.alert(
                'PIN reset requested',
                "When the child's phone next syncs, the existing PIN will be cleared and they'll be prompted to set a new one.",
              );
            } catch (e: any) {
              Alert.alert('Could not request reset', e?.message ?? 'Unknown error');
            } finally {
              setResetting(false);
            }
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={{paddingBottom: spacing.xl}}>
        <View style={styles.tabbar}>
          <TabButton label="Apps" active={tab === 'apps'} onPress={() => setTab('apps')} />
          <TabButton label="Location" active={tab === 'location'} onPress={() => setTab('location')} />
          <TabButton label="Contacts" active={tab === 'contacts'} onPress={() => setTab('contacts')} />
        </View>
        <Pressable
          style={styles.scheduleBtn}
          onPress={() => navigation.navigate('Schedule', {childUid, childName})}>
          <Text style={styles.scheduleBtnLabel}>Schedule</Text>
          <Text style={styles.scheduleBtnHint}>Allow only specific apps during chosen hours</Text>
        </Pressable>

        <Pressable
          style={[styles.actionBtn, resetting && {opacity: 0.6}]}
          disabled={resetting}
          onPress={confirmResetPin}>
          <Text style={styles.actionBtnLabel}>Reset child PIN</Text>
          <Text style={styles.actionBtnHint}>
            {resetting
              ? 'Requesting…'
              : 'Use if you forgot the PIN. Child phone will re-prompt to set a new one.'}
          </Text>
        </Pressable>

        <TamperPanel events={tamperEvents} />

        <View style={{minHeight: 360}}>
          {tab === 'apps' && <AppsTab childUid={childUid} />}
          {tab === 'location' && <LocationTab childUid={childUid} />}
          {tab === 'contacts' && <ContactsTab childUid={childUid} />}
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
          <View style={{flex: 1}}>
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
    borderRadius: radius.pill,
  },
  tabActive: {backgroundColor: colors.primary},
  tabLabel: {color: colors.textMuted, fontWeight: '600'},
  tabLabelActive: {color: colors.primaryText},
  scheduleBtn: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  scheduleBtnLabel: {color: colors.text, fontSize: 15, fontWeight: '700'},
  scheduleBtnHint: {color: colors.textMuted, fontSize: 12, marginTop: 2},
  actionBtn: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.warning,
  },
  actionBtnLabel: {color: colors.text, fontSize: 15, fontWeight: '700'},
  actionBtnHint: {color: colors.textMuted, fontSize: 12, marginTop: 2},
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
