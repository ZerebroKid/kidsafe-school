import React, {useMemo} from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {useClassStudentRows} from '../../firebase/studyReports';
import {useAuthStore} from '../../state/authStore';
import {colors, radius, spacing} from '../../theme';
import type {TeacherStackParamList} from '../../navigation/types';
import {ClassReportCharts, type ClassMetrics} from './ClassReportCharts';

type Props = NativeStackScreenProps<TeacherStackParamList, 'TeacherClassReport'>;

/**
 * P4.11.2 -- teacher per-class study report.
 *
 * Shows the aggregated visuals (stat cards + outcome donut + score histogram)
 * derived from `useClassStudentRows`. The full per-student roster lives on a
 * separate screen reached via the "See full student list" header link.
 */
export function ClassReportScreen({route, navigation}: Props) {
  const {classId, className} = route.params;
  const uid = useAuthStore(s => s.firebaseUid);

  const {rows, loading, error} = useClassStudentRows(classId, uid);

  const attemptedCount = rows.filter(r => r.latest !== null).length;

  const metrics = useMemo<ClassMetrics>(() => {
    const total = rows.length;
    const attemptedRows = rows.filter(r => r.latest !== null);
    const attempted = attemptedRows.length;
    const passed = attemptedRows.filter(r => r.latest?.passed).length;
    const sum = attemptedRows.reduce(
      (acc, r) => acc + (r.latest?.lastPercentage ?? 0),
      0,
    );
    const buckets = [0, 0, 0, 0, 0];
    for (const r of attemptedRows) {
      const pct = r.latest?.lastPercentage ?? 0;
      const idx = Math.min(4, Math.floor(pct / 20));
      buckets[idx] += 1;
    }
    return {
      total,
      attempted,
      notAttempted: total - attempted,
      passed,
      failed: attempted - passed,
      avg: attempted > 0 ? Math.round(sum / attempted) : null,
      buckets,
    };
  }, [rows]);

  const showStudentsLink = !loading && !error && rows.length > 0;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={() => {}}
          tintColor={colors.primary}
        />
      }>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Class {className}</Text>
          {!loading && !error ? (
            <Text style={styles.subtitle}>
              {attemptedCount} of {rows.length} attempted
            </Text>
          ) : null}
        </View>
        {showStudentsLink ? (
          <Pressable
            hitSlop={8}
            onPress={() =>
              navigation.navigate('TeacherClassStudents', {classId, className})
            }>
            <Text style={styles.link}>View students ›</Text>
          </Pressable>
        ) : null}
      </View>

      {error ? (
        <Text style={styles.errorBanner}>{error}</Text>
      ) : loading ? (
        <ActivityIndicator color={colors.primary} />
      ) : rows.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No students in this class yet.</Text>
          <Text style={styles.emptyBody}>
            Ask your principal to add students to this class. Their quiz results
            will appear here once they start.
          </Text>
        </View>
      ) : (
        <ClassReportCharts metrics={metrics} />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {flex: 1, backgroundColor: colors.bg},
  container: {padding: spacing.lg, gap: spacing.lg},
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headerText: {flex: 1},
  title: {color: colors.text, fontSize: 22, fontWeight: '700'},
  subtitle: {color: colors.textMuted, fontSize: 13, marginTop: spacing.xs},
  link: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'right',
  },
  errorBanner: {
    padding: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(248, 113, 113, 0.12)',
    color: colors.danger,
    fontSize: 13,
  },
  empty: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  emptyTitle: {color: colors.text, fontSize: 15, fontWeight: '600'},
  emptyBody: {color: colors.textMuted, fontSize: 13, lineHeight: 18},
});
