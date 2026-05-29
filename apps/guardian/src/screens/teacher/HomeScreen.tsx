import React, {useMemo} from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {signOut} from '@zerebro/shared-firebase/auth';
import {Button} from '../../components/Button';
import {
  useTeacherActiveSchool,
  useTeacherAssignmentsToday,
  useTeacherClasses,
  type AssignmentRow,
} from '../../firebase/teacher';
import {useAuthStore} from '../../state/authStore';
import {colors, radius, spacing} from '../../theme';
import type {TeacherStackParamList} from '../../navigation/types';

type Props = NativeStackScreenProps<TeacherStackParamList, 'TeacherHome'>;

/**
 * P4.5.3 -- teacher's daily home.
 *
 * Header: greeting + school name. Primary CTA: "Assign a topic". Body:
 * today's assignments grouped by class, with empty state when none.
 *
 * The screen is intentionally read-only -- cancel / delete actions are
 * out of scope for P4.5 and land in a later micro-task. A teacher who
 * mis-assigns a topic today re-assigns tomorrow (or cancels via the
 * admin Firestore console for now).
 */
export function TeacherHomeScreen({navigation}: Props) {
  const uid = useAuthStore(s => s.firebaseUid);
  const schoolState = useTeacherActiveSchool(uid);
  const classesState = useTeacherClasses(schoolState.data?.schoolId ?? null, uid);
  const assignmentsState = useTeacherAssignmentsToday(uid);

  const byClass = useMemo(() => {
    const out = new Map<string, AssignmentRow[]>();
    for (const a of assignmentsState.data ?? []) {
      const list = out.get(a.classId) ?? [];
      list.push(a);
      out.set(a.classId, list);
    }
    return out;
  }, [assignmentsState.data]);

  const refreshing =
    schoolState.loading || classesState.loading || assignmentsState.loading;

  const teacherName = schoolState.data?.displayName ?? 'Teacher';

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          // Listeners refresh themselves; this is purely a visual affordance.
          onRefresh={() => {}}
          tintColor={colors.primary}
        />
      }>
      <View>
        <View style={styles.headerRow}>
          <Text style={styles.greeting}>Welcome, {teacherName}</Text>
          <Pressable hitSlop={8} onPress={confirmSignOut}>
            <Text style={styles.signOut}>Sign out</Text>
          </Pressable>
        </View>
        {schoolState.error ? (
          <Text style={styles.errorBanner}>{schoolState.error}</Text>
        ) : !schoolState.data && !schoolState.loading ? (
          <Text style={styles.bodyMuted}>
            You don't have any active school membership yet. Ask your principal
            to approve your teacher request.
          </Text>
        ) : null}
      </View>

      <Button
        title="Assign a topic"
        onPress={() => navigation.navigate('TeacherAssign')}
        disabled={!schoolState.data || (classesState.data?.length ?? 0) === 0}
      />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Today's assignments</Text>
        {assignmentsState.loading && !assignmentsState.data ? (
          <ActivityIndicator color={colors.primary} />
        ) : assignmentsState.error ? (
          <Text style={styles.errorBanner}>{assignmentsState.error}</Text>
        ) : (assignmentsState.data?.length ?? 0) === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No assignments yet.</Text>
            <Text style={styles.emptyBody}>
              Tap "Assign a topic" above to send a chapter to your class.
              Students will see it in their ZKid Study Mission within a few
              seconds.
            </Text>
          </View>
        ) : (
          renderByClass(byClass, classesState.data ?? [], (classId, className) =>
            navigation.navigate('TeacherClassReport', {classId, className}),
          )
        )}
      </View>
    </ScrollView>
  );
}

function renderByClass(
  byClass: Map<string, AssignmentRow[]>,
  classes: Array<{id: string; className: string}>,
  onOpenReport: (classId: string, className: string) => void,
): React.ReactElement {
  const classLabel = new Map<string, string>();
  for (const c of classes) classLabel.set(c.id, c.className);
  const groups = Array.from(byClass.entries()).sort(([a], [b]) =>
    (classLabel.get(a) ?? a).localeCompare(classLabel.get(b) ?? b),
  );
  return (
    <View style={{gap: spacing.md}}>
      {groups.map(([classId, rows]) => {
        const className = classLabel.get(classId) ?? classId;
        return (
        <View key={classId} style={styles.classGroup}>
          <Pressable
            style={styles.classGroupHeader}
            onPress={() => onOpenReport(classId, className)}>
            <Text style={styles.classGroupTitle}>Class {className}</Text>
            <Text style={styles.classGroupLink}>View report ›</Text>
          </Pressable>
          {rows.map(row => (
            <View key={row.id} style={styles.card}>
              <Text style={styles.cardTitle}>{row.topicName}</Text>
              <Text style={styles.cardMeta}>
                Due {formatDueAt(row.dueAt)} • {row.subjectName}
              </Text>
            </View>
          ))}
        </View>
        );
      })}
    </View>
  );
}

function confirmSignOut(): void {
  Alert.alert('Sign out', 'You will need to sign in again with your phone number.', [
    {text: 'Cancel', style: 'cancel'},
    {
      text: 'Sign out',
      style: 'destructive',
      onPress: () => {
        signOut().catch(err => console.warn('signOut failed', err));
      },
    },
  ]);
}

function formatDueAt(epochMs: number): string {
  try {
    return new Date(epochMs).toLocaleString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      day: 'numeric',
      month: 'short',
    });
  } catch {
    return new Date(epochMs).toISOString();
  }
}

const styles = StyleSheet.create({
  scroll: {flex: 1, backgroundColor: colors.bg},
  container: {padding: spacing.lg, gap: spacing.lg},
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  greeting: {flex: 1, color: colors.text, fontSize: 24, fontWeight: '700'},
  signOut: {color: colors.danger, fontSize: 14, fontWeight: '600'},
  bodyMuted: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: spacing.xs,
  },
  errorBanner: {
    marginTop: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(248, 113, 113, 0.12)',
    color: colors.danger,
    fontSize: 13,
  },
  section: {gap: spacing.sm},
  sectionTitle: {color: colors.text, fontSize: 16, fontWeight: '600'},
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
  classGroup: {gap: spacing.xs},
  classGroupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  classGroupTitle: {
    color: colors.textMuted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  classGroupLink: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  cardTitle: {color: colors.text, fontSize: 15, fontWeight: '600'},
  cardMeta: {color: colors.textMuted, fontSize: 12},
});
