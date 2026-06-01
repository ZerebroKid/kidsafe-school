import React from 'react';
import {
  ActivityIndicator,
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

type Props = NativeStackScreenProps<
  TeacherStackParamList,
  'TeacherClassStudents'
>;

/**
 * P4.11.4 -- full per-student roster for a class, reached from the class
 * report's "See full student list" link. Each row shows the student's most
 * recent attempt (topic + score + passed badge) or "Not attempted yet". Uses
 * the same `useClassStudentRows` source as the report so the two stay in sync.
 */
export function ClassStudentListScreen({route}: Props) {
  const {classId, className} = route.params;
  const uid = useAuthStore(s => s.firebaseUid);

  const {rows, loading, error} = useClassStudentRows(classId, uid);

  const attemptedCount = rows.filter(r => r.latest !== null).length;

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
      <View>
        <Text style={styles.title}>Class {className}</Text>
        {!loading && !error ? (
          <Text style={styles.subtitle}>
            {rows.length} {rows.length === 1 ? 'student' : 'students'} •{' '}
            {attemptedCount} attempted
          </Text>
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
        <View style={styles.list}>
          {rows.map(row => (
            <View key={row.childUid} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardName}>{row.name}</Text>
                {row.latest ? (
                  <View
                    style={[
                      styles.badge,
                      row.latest.passed ? styles.badgePass : styles.badgeFail,
                    ]}>
                    <Text
                      style={[
                        styles.badgeText,
                        row.latest.passed
                          ? styles.badgeTextPass
                          : styles.badgeTextFail,
                      ]}>
                      {row.latest.lastPercentage}%
                    </Text>
                  </View>
                ) : null}
              </View>
              {row.latest ? (
                <Text style={styles.cardMeta}>
                  {row.latest.topicName}
                  {row.latest.passed ? ' • Passed' : ' • Keep going'}
                </Text>
              ) : (
                <Text style={styles.cardMetaMuted}>Not attempted yet</Text>
              )}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {flex: 1, backgroundColor: colors.bg},
  container: {padding: spacing.lg, gap: spacing.lg},
  title: {color: colors.text, fontSize: 22, fontWeight: '700'},
  subtitle: {color: colors.textMuted, fontSize: 13, marginTop: spacing.xs},
  errorBanner: {
    padding: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(231, 0, 11, 0.08)',
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
  list: {gap: spacing.sm},
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  cardName: {flex: 1, color: colors.text, fontSize: 15, fontWeight: '600'},
  cardMeta: {color: colors.textMuted, fontSize: 12},
  cardMetaMuted: {color: colors.textMuted, fontSize: 12, fontStyle: 'italic'},
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  badgePass: {backgroundColor: 'rgba(74, 222, 128, 0.12)'},
  badgeFail: {backgroundColor: 'rgba(250, 204, 21, 0.12)'},
  badgeText: {fontSize: 12, fontWeight: '700'},
  badgeTextPass: {color: colors.success},
  badgeTextFail: {color: colors.warning},
});
