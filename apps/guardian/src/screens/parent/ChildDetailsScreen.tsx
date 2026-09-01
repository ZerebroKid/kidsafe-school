import React, {useEffect, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {paths} from '@zerebro/shared-firebase/firestore';
import {useParentTheme} from '../../state/themeStore';
import type {ParentStackParamList} from '../../navigation/types';
import {AppsTab} from './AppsTab';
import {CurrentAppPill} from './CurrentAppPill';
import {LocationTab} from './LocationTab';
import {PinTab} from './PinTab';
import {ScheduleTab} from './ScheduleTab';
import {ReelsInsightsTab} from './ReelsInsightsTab';
import {StudyTab} from './StudyTab';
import {ParentBackground} from './components/ParentBackground';
import {ParentHeader} from './components/ParentHeader';
import {parentRadius, parentSpacing} from './theme/parentTheme';

type Props = NativeStackScreenProps<ParentStackParamList, 'ChildDetails'>;

type Tab = 'apps' | 'schedule' | 'location' | 'pin' | 'study' | 'reels';

const TABS: Array<{key: Tab; label: string; glyph: string}> = [
  {key: 'apps', label: 'Apps', glyph: '📱'},
  {key: 'schedule', label: 'Schedule', glyph: '⏰'},
  {key: 'location', label: 'Location', glyph: '📍'},
  {key: 'study', label: 'Study', glyph: '📚'},
  {key: 'reels', label: 'Reels', glyph: '🎬'},
  {key: 'pin', label: 'PIN', glyph: '🔒'},
];

interface TamperEvent {
  id: string;
  kind: string;
  success: boolean;
  timestamp: number;
}

export function ChildDetailsScreen({route, navigation}: Props) {
  const {childUid, childName = 'Child', initialTab} = route.params || {};
  const [tab, setTab] = useState<Tab>(
    (initialTab as Tab) && TABS.some(t => t.key === initialTab)
      ? (initialTab as Tab)
      : 'apps',
  );
  const [tamperEvents, setTamperEvents] = useState<TamperEvent[]>([]);
  const {theme, isDark} = useParentTheme();

  const isValidChild = Boolean(childUid && childUid !== 'default' && childUid !== 'new');

  useEffect(() => {
    if (!isValidChild) return;
    const unsub = paths
      .events(childUid)
      .where('type', '==', 'tamper_attempt')
      .orderBy('timestamp', 'desc')
      .limit(1)
      .onSnapshot(
        snap => {
          setTamperEvents(
            snap.docs.map(d => {
              const data = d.data() as Partial<TamperEvent>;
              return {
                id: d.id,
                kind: typeof data.kind === 'string' ? data.kind : 'unknown',
                success: data.success === true,
                timestamp:
                  typeof data.timestamp === 'number' ? data.timestamp : 0,
              };
            }),
          );
        },
        err => console.warn('tamper events sub error', err),
      );
    return unsub;
  }, [childUid, isValidChild]);

  if (!isValidChild) {
    return (
      <ParentBackground>
        <ParentHeader
          title="Child Controls"
          subtitle="Device & Safety Controls"
          onBack={() => navigation.goBack()}
        />
        <View style={{flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24}}>
          <Text style={{color: theme.text, fontSize: 18, fontWeight: '700', marginBottom: 8, textAlign: 'center'}}>
            No Child Selected
          </Text>
          <Text style={{color: theme.textMuted, fontSize: 14, textAlign: 'center', marginBottom: 20}}>
            Pair a child device first from Settings to view and manage device controls.
          </Text>
          <Pressable
            onPress={() => navigation.navigate('Settings')}
            style={{backgroundColor: theme.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12}}>
            <Text style={{color: '#FFFFFF', fontWeight: '700', fontSize: 14}}>
              Generate Pairing Code
            </Text>
          </Pressable>
        </View>
      </ParentBackground>
    );
  }

  return (
    <ParentBackground>
      <ParentHeader
        title={childName}
        subtitle="Device & Safety Controls"
        onBack={() => navigation.goBack()}
      />

      {/* Sticky status strip */}
      <View style={styles.statusStrip}>
        <CurrentAppPill childUid={childUid} />
      </View>

      {/* Body with Tabs */}
      <View style={styles.body}>
        {/* Horizontal Chips Bar */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabbar}
          contentContainerStyle={styles.tabbarContent}>
          {TABS.map(t => {
            const active = tab === t.key;
            return (
              <Pressable
                key={t.key}
                onPress={() => setTab(t.key)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active
                      ? theme.primary
                      : isDark
                      ? 'rgba(255, 255, 255, 0.08)'
                      : '#FFFFFF',
                    borderColor: active ? theme.primary : theme.cardBorder,
                  },
                ]}>
                <Text style={{fontSize: 13}}>{t.glyph}</Text>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.chipLabel,
                    {
                      color: active
                        ? '#FFFFFF'
                        : isDark
                        ? theme.textMuted
                        : theme.text,
                      fontWeight: active ? '700' : '500',
                    },
                  ]}>
                  {t.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {tab === 'location' ? (
          <LocationTab childUid={childUid} />
        ) : (
          <ScrollView
            style={styles.scrollableTab}
            contentContainerStyle={styles.scrollableTabContent}
            keyboardShouldPersistTaps="handled">
            {tab === 'apps' && (
              <>
                <TamperPanel events={tamperEvents} />
                <AppsTab childUid={childUid} />
              </>
            )}
            {tab === 'schedule' && <ScheduleTab childUid={childUid} />}
            {tab === 'study' && <StudyTab childUid={childUid} />}
            {tab === 'reels' && (
              <ReelsInsightsTab
                childUid={childUid}
                childName={childName}
              />
            )}
            {tab === 'pin' && (
              <PinTab childUid={childUid} childName={childName} />
            )}
          </ScrollView>
        )}
      </View>
    </ParentBackground>
  );
}

function TamperPanel({events}: {events: TamperEvent[]}) {
  const {theme, isDark} = useParentTheme();
  if (events.length === 0) {
    return null;
  }
  return (
    <View
      style={[
        styles.tamperCard,
        {
          backgroundColor: isDark
            ? 'rgba(23, 19, 79, 0.88)'
            : theme.cardBg,
          borderColor: theme.cardBorder,
        },
      ]}>
      <Text style={[styles.tamperTitle, {color: theme.text}]}>
        Latest uninstall attempt
      </Text>
      {events.map(e => (
        <View key={e.id} style={styles.tamperRow}>
          <View
            style={[
              styles.tamperDot,
              {
                backgroundColor: e.success
                  ? theme.warning
                  : theme.danger,
              },
            ]}
          />
          <View style={styles.tamperRowText}>
            <Text style={[styles.tamperKind, {color: theme.text}]}>
              {labelForKind(e.kind)}
            </Text>
            <Text style={[styles.tamperMeta, {color: theme.textMuted}]}>
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

const styles = StyleSheet.create({
  statusStrip: {
    paddingHorizontal: parentSpacing.lg,
    paddingTop: parentSpacing.xs,
    width: '100%',
    overflow: 'hidden',
  },
  body: {
    flex: 1,
  },
  scrollableTab: {
    flex: 1,
  },
  scrollableTabContent: {
    paddingBottom: parentSpacing.xl,
    flexGrow: 1,
  },
  tabbar: {
    flexGrow: 0,
    marginVertical: parentSpacing.sm,
  },
  tabbarContent: {
    paddingHorizontal: parentSpacing.lg,
    paddingVertical: parentSpacing.xs,
    gap: parentSpacing.sm,
    alignItems: 'center',
  },
  chip: {
    borderRadius: parentRadius.pill,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chipLabel: {
    fontSize: 13,
  },
  tamperCard: {
    marginHorizontal: parentSpacing.lg,
    marginBottom: parentSpacing.md,
    borderRadius: parentRadius.lg,
    borderWidth: 1,
    padding: parentSpacing.md,
    gap: parentSpacing.sm,
  },
  tamperTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  tamperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: parentSpacing.sm,
  },
  tamperRowText: {flex: 1},
  tamperDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  tamperKind: {
    fontSize: 13,
    fontWeight: '600',
  },
  tamperMeta: {
    fontSize: 11,
    marginTop: 1,
  },
});
