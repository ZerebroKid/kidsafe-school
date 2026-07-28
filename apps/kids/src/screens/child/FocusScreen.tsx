import React, {useEffect, useMemo, useState} from 'react';
import {ActivityIndicator, ScrollView, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {subscribeChildDoc} from '@zerebro/shared-firebase/firestore';
import type {ChildDoc, Schedule} from '@zerebro/shared-types';

import {useAuthStore} from '../../state/authStore';
import {colors, radius, spacing} from '../../theme';

/**
 * The child's read-only view of the focus schedule.
 *
 * A parent owns schedule changes in ZConnect. Rendering the same Firestore
 * document here keeps the child informed without creating a client-side path
 * around the parent controls or Android enforcement service.
 */
export function FocusScreen() {
  const uid = useAuthStore(s => s.firebaseUid);
  const [childDoc, setChildDoc] = useState<ChildDoc | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    return subscribeChildDoc(uid, doc => {
      setChildDoc(doc);
      setLoading(false);
    });
  }, [uid]);

  const schedule = childDoc?.schedule;
  const status = useMemo(() => getScheduleStatus(schedule), [schedule]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Focus</Text>
        <Text style={styles.subtitle}>
          Your study schedule is set by your parent and works with your school day.
        </Text>

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.loadingText}>Checking your schedule</Text>
          </View>
        ) : !schedule || !schedule.enabled ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>◷</Text>
            <Text style={styles.emptyTitle}>No focus window set</Text>
            <Text style={styles.emptyCopy}>
              When your parent creates a study schedule, it will appear here.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.windowCard}>
              <Text style={styles.eyebrow}>STUDY WINDOW</Text>
              <View style={styles.timeRow}>
                <Text style={styles.time}>{formatTime(schedule.startMinutes)}</Text>
                <Text style={styles.timeArrow}>→</Text>
                <Text style={styles.time}>{formatTime(schedule.endMinutes)}</Text>
              </View>
              <Text style={styles.windowDays}>{formatDays(schedule.daysOfWeek)}</Text>
              <View style={[styles.statusPill, status.active ? styles.statusPillActive : undefined]}>
                <Text style={[styles.statusText, status.active ? styles.statusTextActive : undefined]}>
                  {status.label}
                </Text>
              </View>
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>How focus works</Text>
              <Text style={styles.infoCopy}>
                During this window, only the apps your parent has allowed stay available.
                Your learning apps remain available for the subjects your teacher assigns.
              </Text>
            </View>

            <View style={styles.allowedCard}>
              <Text style={styles.allowedLabel}>ALLOWED APPS</Text>
              <Text style={styles.allowedValue}>
                {schedule.allowedPackages.length === 0
                  ? 'Your parent has not chosen specific apps yet.'
                  : `${schedule.allowedPackages.length} app${schedule.allowedPackages.length === 1 ? '' : 's'} available during focus time`}
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function getScheduleStatus(schedule: Schedule | undefined) {
  if (!schedule?.enabled) return {active: false, label: 'No active schedule'};
  const now = new Date();
  const weekday = now.getDay();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const appliesToday = schedule.daysOfWeek.includes(weekday);
  const wrapsMidnight = schedule.endMinutes <= schedule.startMinutes;
  const withinWindow = wrapsMidnight
    ? minutes >= schedule.startMinutes || minutes < schedule.endMinutes
    : minutes >= schedule.startMinutes && minutes < schedule.endMinutes;
  return appliesToday && withinWindow
    ? {active: true, label: 'Focus time is active'}
    : {active: false, label: 'Your next focus window is scheduled'};
}

function formatTime(totalMinutes: number) {
  const minutes = ((totalMinutes % 1440) + 1440) % 1440;
  const hour = Math.floor(minutes / 60);
  const min = minutes % 60;
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${String(min).padStart(2, '0')} ${suffix}`;
}

function formatDays(days: number[]) {
  const short = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  if (days.length === 5 && [1, 2, 3, 4, 5].every(d => days.includes(d))) return 'Monday to Friday';
  if (days.length === 7) return 'Every day';
  return [...days].sort().map(day => short[day]).join(' · ');
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: colors.bg},
  screen: {flex: 1, backgroundColor: colors.bg},
  content: {padding: spacing.lg, paddingBottom: spacing.xl, gap: spacing.lg},
  title: {fontSize: 28, fontWeight: '800', color: colors.text, letterSpacing: -0.5},
  subtitle: {fontSize: 14, color: colors.textMuted, lineHeight: 20, marginTop: -spacing.md},
  loading: {paddingVertical: 80, alignItems: 'center', gap: spacing.sm},
  loadingText: {fontSize: 14, color: colors.textMuted},
  windowCard: {backgroundColor: '#f0edff', borderRadius: radius.lg, padding: spacing.lg, alignItems: 'center', gap: spacing.sm},
  eyebrow: {fontSize: 11, fontWeight: '800', letterSpacing: 1, color: colors.primary},
  timeRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm},
  time: {fontSize: 25, fontWeight: '800', color: colors.primary},
  timeArrow: {fontSize: 24, fontWeight: '700', color: '#a49bc5'},
  windowDays: {fontSize: 13, fontWeight: '600', color: '#5d5578'},
  statusPill: {marginTop: spacing.xs, paddingVertical: 7, paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: '#ffffff'},
  statusPillActive: {backgroundColor: '#dff7e9'},
  statusText: {fontSize: 12, fontWeight: '800', color: '#5d5578'},
  statusTextActive: {color: '#16784b'},
  infoCard: {borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: spacing.xs, backgroundColor: colors.surface},
  infoTitle: {fontSize: 16, fontWeight: '800', color: colors.text},
  infoCopy: {fontSize: 13, lineHeight: 20, color: colors.textMuted},
  allowedCard: {borderRadius: radius.md, padding: spacing.md, gap: spacing.xs, backgroundColor: '#f8f8fb'},
  allowedLabel: {fontSize: 11, fontWeight: '800', letterSpacing: 0.8, color: colors.textMuted},
  allowedValue: {fontSize: 14, fontWeight: '700', color: colors.text},
  emptyCard: {minHeight: 230, borderRadius: radius.lg, backgroundColor: '#f8f8fb', alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm},
  emptyIcon: {fontSize: 42, color: colors.primary},
  emptyTitle: {fontSize: 18, fontWeight: '800', color: colors.text},
  emptyCopy: {fontSize: 14, lineHeight: 21, color: colors.textMuted, textAlign: 'center'},
});
