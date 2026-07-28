import React, {useEffect, useMemo, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Switch, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {colors, radius, spacing} from '../../theme';
import {
  setLock,
  subscribeChildDoc,
  subscribeLinkedChildren,
} from '@zerebro/shared-firebase/firestore';
import {useAuthStore} from '../../state/authStore';
import type {ChildDoc, UserDoc} from '@zerebro/shared-types';
import type {ParentStackParamList} from '../../navigation/types';

type ChildRow = UserDoc & {uid: string; doc: ChildDoc | null};

/**
 * Production parent landing screen.
 *
 * It deliberately displays only data that exists on the linked child document:
 * status, parent-controlled lock state and screen-time totals. Opening a child
 * leads to the existing detailed Apps, Schedule, Location, Study and Usage UI.
 */
export function ChildrenListScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<ParentStackParamList>>();
  const parentUid = useAuthStore(s => s.firebaseUid);
  const parentName = useAuthStore(s => s.userDoc?.displayName ?? s.userDoc?.name ?? 'Parent');
  const [rows, setRows] = useState<ChildRow[]>([]);

  useEffect(() => {
    if (!parentUid) return;
    const childSubscriptions: Array<() => void> = [];
    const unsubscribeChildren = subscribeLinkedChildren(parentUid, list => {
      childSubscriptions.forEach(unsubscribe => unsubscribe());
      childSubscriptions.length = 0;
      setRows(list.map(child => ({...child, doc: null})));
      list.forEach(child => {
        childSubscriptions.push(
          subscribeChildDoc(child.uid, doc => {
            setRows(previous =>
              previous.map(row => (row.uid === child.uid ? {...row, doc} : row)),
            );
          }),
        );
      });
    });
    return () => {
      unsubscribeChildren();
      childSubscriptions.forEach(unsubscribe => unsubscribe());
    };
  }, [parentUid]);

  const greetingName = parentName.trim().split(/\s+/)[0] || 'there';
  const onlineCount = useMemo(
    () => rows.filter(row => row.doc?.status === 'online').length,
    [rows],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.date}>{formatToday()}</Text>
          <Text style={styles.greeting}>Hello, {greetingName}</Text>
          <Text style={styles.subtitle}>
            {rows.length === 0
              ? 'Link a child’s phone to begin.'
              : `${onlineCount} child${onlineCount === 1 ? '' : 'ren'} online right now`}
          </Text>
        </View>

        {rows.length === 0 ? <EmptyState /> : null}

        {rows.map((row, index) => {
          const name = displayNameFor(row);
          return (
            <ChildDashboardCard
              key={row.uid}
              row={row}
              highlighted={index === 0}
              name={name}
              onOpen={() => navigation.navigate('ChildDetails', {childUid: row.uid, childName: name})}
            />
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

function ChildDashboardCard({
  row,
  name,
  highlighted,
  onOpen,
}: {
  row: ChildRow;
  name: string;
  highlighted: boolean;
  onOpen: () => void;
}) {
  const screenTime = formatScreenTime(row.doc?.screenTime?.usedTodayMins);
  const online = row.doc?.status === 'online';
  const locked = row.doc?.lockState?.locked ?? false;

  async function toggleLock(value: boolean) {
    await setLock(row.uid, value);
  }

  return (
    <View style={[styles.childCard, highlighted && styles.childCardFeatured]}>
      <Pressable accessibilityRole="button" onPress={onOpen} style={styles.childTop}>
        <View style={[styles.initial, highlighted && styles.initialFeatured]}>
          <Text style={[styles.initialText, highlighted && styles.initialTextFeatured]}>
            {name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.childIdentity}>
          <Text style={[styles.childName, highlighted && styles.childNameFeatured]}>{name}</Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, {backgroundColor: online ? '#1d9b62' : '#91919d'}]} />
            <Text style={[styles.statusText, highlighted && styles.statusTextFeatured]}>
              {online ? 'Phone online' : 'Phone offline'}
            </Text>
          </View>
        </View>
        <Text style={[styles.openArrow, highlighted && styles.openArrowFeatured]}>→</Text>
      </Pressable>

      <View style={styles.metricsRow}>
        <Metric label="Screen time" value={screenTime} highlighted={highlighted} />
        <Metric label="Safety" value={locked ? 'Locked' : 'Protected'} highlighted={highlighted} />
      </View>

      <View style={[styles.lockRow, highlighted && styles.lockRowFeatured]}>
        <View style={styles.lockText}>
          <Text style={[styles.lockTitle, highlighted && styles.lockTitleFeatured]}>Phone lock</Text>
          <Text style={[styles.lockCopy, highlighted && styles.lockCopyFeatured]}>
            {locked ? 'Only emergency apps are available.' : 'Your child’s phone is available.'}
          </Text>
        </View>
        <Switch
          value={locked}
          onValueChange={toggleLock}
          trackColor={{true: '#1d9b62', false: highlighted ? '#b9b4d5' : colors.border}}
          thumbColor="#ffffff"
          accessibilityLabel={`Toggle lock for ${name}`}
        />
      </View>

      <Pressable accessibilityRole="button" onPress={onOpen} style={[styles.detailsButton, highlighted && styles.detailsButtonFeatured]}>
        <Text style={[styles.detailsLabel, highlighted && styles.detailsLabelFeatured]}>Open dashboard</Text>
        <Text style={[styles.detailsArrow, highlighted && styles.detailsLabelFeatured]}>→</Text>
      </Pressable>
    </View>
  );
}

function Metric({label, value, highlighted}: {label: string; value: string; highlighted: boolean}) {
  return (
    <View style={[styles.metric, highlighted && styles.metricFeatured]}>
      <Text style={[styles.metricValue, highlighted && styles.metricValueFeatured]}>{value}</Text>
      <Text style={[styles.metricLabel, highlighted && styles.metricLabelFeatured]}>{label}</Text>
    </View>
  );
}

function EmptyState() {
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyIcon}>⌁</Text>
      <Text style={styles.emptyTitle}>Link your child’s phone</Text>
      <Text style={styles.emptyCopy}>
        Open Settings to create a pairing code, then enter it on the child’s ZKid phone.
      </Text>
    </View>
  );
}

function displayNameFor(row: ChildRow) {
  return row.displayName?.trim() || row.name?.trim() || 'Student';
}

function formatScreenTime(minutes: number | undefined) {
  if (!minutes || minutes < 1) return '0m';
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return hours > 0 ? `${hours}h ${remainder}m` : `${remainder}m`;
}

function formatToday() {
  return new Date().toLocaleDateString('en-IN', {weekday: 'long', day: 'numeric', month: 'long'});
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: colors.bg},
  screen: {flex: 1, backgroundColor: colors.bg},
  content: {padding: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md},
  header: {gap: 5, marginBottom: spacing.sm},
  date: {fontSize: 12, color: colors.textMuted, fontWeight: '600'},
  greeting: {fontSize: 28, fontWeight: '800', color: colors.text, letterSpacing: -0.5},
  subtitle: {fontSize: 14, color: colors.textMuted},
  childCard: {borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: spacing.md, gap: spacing.md},
  childCardFeatured: {backgroundColor: colors.primary, borderColor: colors.primary},
  childTop: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm},
  initial: {width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#e9e6fb'},
  initialFeatured: {backgroundColor: 'rgba(255,255,255,0.18)'},
  initialText: {fontSize: 18, color: colors.primary, fontWeight: '800'},
  initialTextFeatured: {color: '#ffffff'},
  childIdentity: {flex: 1, gap: 3},
  childName: {fontSize: 18, fontWeight: '800', color: colors.text},
  childNameFeatured: {color: '#ffffff'},
  statusRow: {flexDirection: 'row', alignItems: 'center', gap: 5},
  statusDot: {width: 7, height: 7, borderRadius: 4},
  statusText: {fontSize: 12, color: colors.textMuted, fontWeight: '600'},
  statusTextFeatured: {color: '#e8e4ff'},
  openArrow: {fontSize: 23, fontWeight: '800', color: colors.primary},
  openArrowFeatured: {color: '#ffffff'},
  metricsRow: {flexDirection: 'row', gap: spacing.sm},
  metric: {flex: 1, borderRadius: radius.md, backgroundColor: '#f8f8fb', padding: spacing.sm, gap: 2},
  metricFeatured: {backgroundColor: 'rgba(255,255,255,0.13)'},
  metricValue: {fontSize: 17, fontWeight: '800', color: colors.text},
  metricValueFeatured: {color: '#ffffff'},
  metricLabel: {fontSize: 11, color: colors.textMuted, fontWeight: '600'},
  metricLabelFeatured: {color: '#e8e4ff'},
  lockRow: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm},
  lockRowFeatured: {},
  lockText: {flex: 1, gap: 2},
  lockTitle: {fontSize: 14, fontWeight: '800', color: colors.text},
  lockTitleFeatured: {color: '#ffffff'},
  lockCopy: {fontSize: 12, lineHeight: 17, color: colors.textMuted},
  lockCopyFeatured: {color: '#e8e4ff'},
  detailsButton: {minHeight: 45, borderRadius: radius.md, backgroundColor: '#f0edff', paddingHorizontal: spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  detailsButtonFeatured: {backgroundColor: '#ffffff'},
  detailsLabel: {fontSize: 14, fontWeight: '800', color: colors.primary},
  detailsLabelFeatured: {color: colors.primary},
  detailsArrow: {fontSize: 21, fontWeight: '800', color: colors.primary},
  emptyCard: {marginTop: spacing.xl, padding: spacing.xl, borderRadius: radius.lg, backgroundColor: '#f8f8fb', alignItems: 'center', gap: spacing.sm},
  emptyIcon: {fontSize: 42, color: colors.primary},
  emptyTitle: {fontSize: 18, fontWeight: '800', color: colors.text},
  emptyCopy: {fontSize: 14, lineHeight: 21, color: colors.textMuted, textAlign: 'center'},
});
