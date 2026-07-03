import React, {useEffect, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import Svg, {Path} from 'react-native-svg';

import {GradientBackground} from '../../components/GradientBackground';
import {colors, radius, softShadow, spacing} from '../../theme';
import type {ParentStackParamList} from '../../navigation/types';
import {paths} from '@zerebro/shared-firebase/firestore';
import {AppsTab} from './AppsTab';
import {CurrentAppPill} from './CurrentAppPill';
import {LocationTab} from './LocationTab';
import {PinTab} from './PinTab';
import {ScheduleTab} from './ScheduleTab';
import {ReelsInsightsTab} from './ReelsInsightsTab';
import {StudyTab} from './StudyTab';
import {SafeAreaView} from 'react-native-safe-area-context';

type Props = NativeStackScreenProps<ParentStackParamList, 'ChildDetails'>;

type Tab = 'apps' | 'schedule' | 'location' | 'pin' | 'study' | 'reels';

const TABS: Array<{key: Tab; label: string}> = [
  {key: 'apps', label: 'Apps'},
  {key: 'schedule', label: 'Schedule'},
  {key: 'location', label: 'Location'},
  {key: 'study', label: 'Study'},
  {key: 'reels', label: 'Reels'},
  {key: 'pin', label: 'PIN'},
];

interface TamperEvent {
  id: string;
  kind: string;
  success: boolean;
  timestamp: number;
}

export function ChildDetailsScreen({route, navigation}: Props) {
  const {childUid, childName} = route.params;
  const [tab, setTab] = useState<Tab>('apps');
  const [tamperEvents, setTamperEvents] = useState<TamperEvent[]>([]);

  useEffect(() => {
    // Single most-recent tamper attempt — historical list lives in Firestore for audit, but
    // the parent UI only surfaces "what just happened" on the Apps tab. Switching from limit(5)
    // to limit(1) cuts both the on-the-wire payload and the rendered noise.
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
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <GradientBackground />
      {/* Custom large header — the native stack header is hidden for this screen because the
          default title was too small to read. The child name is the hero of this screen. */}
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={8}
          style={({pressed}) => [styles.backButton, pressed && styles.backButtonPressed]}
          accessibilityRole="button"
          accessibilityLabel="Go back">
          <BackArrowIcon />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {childName}
          </Text>
          <Text style={styles.headerSubtitle}>Device Controls</Text>
        </View>
      </View>
      {/* Sticky status strip — sits OUTSIDE the tab body so the live "Currently using"
          card stays visible regardless of which tab is selected or how far the user has
          scrolled inside scrollable tabs. */}
      <View style={styles.statusStrip}>
        <CurrentAppPill childUid={childUid} />
      </View>
      {/* `body` is a column: fixed tab bar + flex-fill content. The Location tab needs the
          flex-fill region — `MapView` with flex:1 does not expand inside an outer ScrollView
          whose content height is only `minHeight: 360`, which produced the half-empty map. */}
      <View style={styles.body}>
        {/* Horizontally scrollable pill chips: seven tabs no longer fit a fixed segmented
            bar at a readable font size, so chips scroll instead of shrinking. */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabbar}
          contentContainerStyle={styles.tabbarContent}>
          {TABS.map(t => (
            <TabChip
              key={t.key}
              label={t.label}
              active={tab === t.key}
              onPress={() => setTab(t.key)}
            />
          ))}
        </ScrollView>

        {tab === 'location' ? (
          <LocationTab childUid={childUid} />
        ) : (
          <ScrollView
            style={styles.scrollableTab}
            contentContainerStyle={styles.scrollableTabContent}
            keyboardShouldPersistTaps="handled">
            {/* Tamper panel is Apps-tab-only by design: it talks about "uninstall attempts"
                which is the same surface the parent reviews when deciding whether to tighten
                the blocklist or rotate the PIN. The Firestore listener stays mounted at the
                screen level (see useEffect above) so switching tabs back to Apps shows the
                latest row immediately with no re-subscribe lag. */}
            {tab === 'apps' && (
              <>
                <TamperPanel events={tamperEvents} />
                <AppsTab childUid={childUid} />
              </>
            )}
            {tab === 'schedule' && <ScheduleTab childUid={childUid} />}
            {tab === 'study' && <StudyTab childUid={childUid} />}
            {tab === 'reels' && <ReelsInsightsTab childUid={childUid} childName={childName} />}
            {tab === 'pin' && <PinTab childUid={childUid} childName={childName} />}
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

function BackArrowIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M19 12H5M11 18l-6-6 6-6"
        stroke={colors.text}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function TamperPanel({events}: {events: TamperEvent[]}) {
  if (events.length === 0) {
    return null;
  }
  return (
    <View style={styles.tamperCard}>
      <Text style={styles.tamperTitle}>Latest uninstall attempt</Text>
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

function TabChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text
        numberOfLines={1}
        style={[styles.chipLabel, active && styles.chipLabelActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: colors.bg},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...softShadow,
  },
  backButtonPressed: {
    opacity: 0.6,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  headerSubtitle: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 19,
    marginTop: 1,
  },
  statusStrip: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    width: '100%',
    overflow: 'hidden',
  },
  /** Column below the status card — tab bar is fixed; Location fills remainder. */
  body: {
    flex: 1,
  },
  /** Scrollable region for every tab except Location (which needs flex-fill for the map). */
  scrollableTab: {
    flex: 1,
  },
  scrollableTabContent: {
    paddingBottom: spacing.xl,
    flexGrow: 1,
  },
  tabbar: {
    flexGrow: 0,
    marginVertical: spacing.md,
  },
  tabbarContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    gap: spacing.sm,
    alignItems: 'center',
  },
  chip: {
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    ...softShadow,
  },
  chipActive: {backgroundColor: colors.primary},
  chipLabel: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '500',
  },
  chipLabelActive: {
    color: colors.primaryText,
    fontWeight: '600',
  },
  tamperCard: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg - 4,
    padding: spacing.md,
    gap: spacing.sm,
    ...softShadow,
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
