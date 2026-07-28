import React, {useMemo, useState} from 'react';
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
import {
  compareTopicOrder,
  useTeacherActiveSchool,
  useTeacherAssignmentsToday,
  useTeacherClasses,
  useTeacherWeakTopics,
  type AssignmentRow,
  type ClassWeakTopics,
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
  const weakState = useTeacherWeakTopics(uid);

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
    schoolState.loading ||
    classesState.loading ||
    assignmentsState.loading ||
    weakState.loading;

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
        <Text style={styles.date}>{formatToday()}</Text>
        <View style={styles.headerRow}>
          <Text style={styles.greeting}>Good morning, {teacherName}</Text>
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

      <ReTeachSection
        groups={weakState.data ?? []}
        onOpenReport={(classId, className) =>
          navigation.navigate('TeacherClassReport', {classId, className})
        }
      />

      <Pressable
        accessibilityRole="button"
        disabled={!schoolState.data || (classesState.data?.length ?? 0) === 0}
        onPress={() => navigation.navigate('TeacherAssign')}
        style={({pressed}) => [
          styles.assignHero,
          pressed && styles.assignHeroPressed,
          (!schoolState.data || (classesState.data?.length ?? 0) === 0) && styles.assignHeroDisabled,
        ]}>
        <View style={styles.assignHeroIcon}>
          <Text style={styles.assignHeroIconText}>✓</Text>
        </View>
        <View style={styles.assignHeroText}>
          <Text style={styles.assignHeroTitle}>Mark topics taught today</Text>
          <Text style={styles.assignHeroCopy}>Assign the full learning loop to your class.</Text>
        </View>
        <Text style={styles.assignHeroArrow}>→</Text>
      </Pressable>

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
          <AssignmentsByClass
            byClass={byClass}
            classes={classesState.data ?? []}
            onOpenReport={(classId, className) =>
              navigation.navigate('TeacherClassReport', {classId, className})
            }
          />
        )}
      </View>
    </ScrollView>
  );
}

function AssignmentsByClass({
  byClass,
  classes,
  onOpenReport,
}: {
  byClass: Map<string, AssignmentRow[]>;
  classes: Array<{id: string; className: string}>;
  onOpenReport: (classId: string, className: string) => void;
}): React.ReactElement {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const classLabel = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of classes) m.set(c.id, c.className);
    return m;
  }, [classes]);

  const groups = useMemo(
    () =>
      Array.from(byClass.entries()).sort(([a], [b]) =>
        (classLabel.get(a) ?? a).localeCompare(classLabel.get(b) ?? b),
      ),
    [byClass, classLabel],
  );

  function toggleSubject(expandKey: string) {
    setExpanded(prev => ({...prev, [expandKey]: !prev[expandKey]}));
  }

  return (
    <View style={styles.assignmentsList}>
      {groups.map(([classId, rows]) => {
        const className = classLabel.get(classId) ?? classId;
        const bySubject = groupBySubject(rows);
        const totalTopics = rows.length;

        return (
          <View key={classId} style={styles.classCard}>
            <View style={styles.classCardTop}>
              <View style={styles.classBadge}>
                <Text style={styles.classBadgeText}>{className}</Text>
              </View>
              <View style={styles.classCardMeta}>
                <Text style={styles.classCardTitle}>Class {className}</Text>
                <Text style={styles.classCardSubtitle}>
                  {bySubject.length} subject{bySubject.length > 1 ? 's' : ''} ·{' '}
                  {totalTopics} topic{totalTopics > 1 ? 's' : ''} today
                </Text>
              </View>
              <Pressable
                style={styles.reportBtn}
                hitSlop={8}
                onPress={() => onOpenReport(classId, className)}>
                <Text style={styles.reportBtnText}>Report</Text>
              </Pressable>
            </View>

            <View style={styles.subjectsList}>
              {bySubject.map(({key, label, assignments}) => {
                const expandKey = `${classId}:${key}`;
                const isOpen = expanded[expandKey] ?? false;
                const initial = label.charAt(0).toUpperCase();

                return (
                  <View
                    key={expandKey}
                    style={[
                      styles.subjectAccordion,
                      isOpen && styles.subjectAccordionOpen,
                    ]}>
                    <Pressable
                      style={({pressed}) => [
                        styles.subjectHeader,
                        pressed && styles.subjectHeaderPressed,
                      ]}
                      onPress={() => toggleSubject(expandKey)}>
                      <View style={styles.subjectIcon}>
                        <Text style={styles.subjectIconText}>{initial}</Text>
                      </View>
                      <View style={styles.subjectHeaderText}>
                        <Text style={styles.subjectTitle}>{label}</Text>
                        <Text style={styles.subjectHint}>
                          {isOpen ? 'Tap to collapse' : 'Tap to view topics'}
                        </Text>
                      </View>
                      <View style={styles.countBadge}>
                        <Text style={styles.countBadgeText}>
                          {assignments.length}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.chevron,
                          isOpen && styles.chevronOpen,
                        ]}
                      />
                    </Pressable>

                    {isOpen ? (
                      <View style={styles.topicsContainer}>
                        {assignments.map((row, idx) => (
                          <View
                            key={row.id}
                            style={[
                              styles.topicItem,
                              idx < assignments.length - 1 &&
                                styles.topicItemBorder,
                            ]}>
                            <View style={styles.topicDot} />
                            <View style={styles.topicContent}>
                              <Text style={styles.topicName} numberOfLines={2}>
                                {row.topicName}
                              </Text>
                              <Text style={styles.topicMeta}>
                                Due {formatDueAt(row.dueAt)}
                                {isDueToday(row.dueAt) ? ' today' : ''}
                              </Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function groupBySubject(rows: AssignmentRow[]): Array<{
  key: string;
  label: string;
  assignments: AssignmentRow[];
}> {
  const map = new Map<string, AssignmentRow[]>();
  for (const row of rows) {
    const key = row.curriculumId || row.subjectName;
    const list = map.get(key) ?? [];
    list.push(row);
    map.set(key, list);
  }
  return Array.from(map.entries())
    .map(([key, assignments]) => {
      const raw = assignments[0]?.subjectName ?? key;
      const label = raw.charAt(0).toUpperCase() + raw.slice(1);
      assignments.sort(compareTopicOrder);
      return {key, label, assignments};
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * P5.4 -- "Re-teach" callout. Surfaces topics whose latest class average fell
 * below the weak threshold (60%), grouped by class. Hidden entirely when there
 * is nothing to re-teach (or the read failed) -- it's a non-critical nudge, so
 * no loading/error chrome.
 */
function ReTeachSection({
  groups,
  onOpenReport,
}: {
  groups: ClassWeakTopics[];
  onOpenReport: (classId: string, className: string) => void;
}): React.ReactElement | null {
  if (groups.length === 0) return null;
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Re-teach</Text>
      <View style={{gap: spacing.md}}>
        {groups.map(group => (
          <Pressable
            key={group.classId}
            style={styles.reteachCard}
            onPress={() => onOpenReport(group.classId, group.className)}>
            <View style={styles.reteachHeader}>
              <Text style={styles.reteachTitle}>Class {group.className}</Text>
              <Text style={styles.classGroupLink}>View report ›</Text>
            </View>
            <View style={styles.reteachTopics}>
              {group.topics.map(t => (
                <View key={t.topicId} style={styles.reteachTopicRow}>
                  <Text style={styles.reteachTopicName} numberOfLines={1}>
                    {t.topicName}
                  </Text>
                  <Text style={styles.reteachTopicScore}>
                    {t.avgBestPercentage}%
                  </Text>
                </View>
              ))}
            </View>
          </Pressable>
        ))}
      </View>
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

function isDueToday(epochMs: number): boolean {
  const d = new Date(epochMs);
  const now = new Date();
  return (
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  );
}

function formatDueAt(epochMs: number): string {
  try {
    const d = new Date(epochMs);
    const now = new Date();
    const sameDay =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();
    if (sameDay) {
      return d.toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
      });
    }
    return d.toLocaleString(undefined, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return new Date(epochMs).toISOString();
  }
}

function formatToday(): string {
  return new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

const styles = StyleSheet.create({
  scroll: {flex: 1, backgroundColor: colors.bg},
  container: {padding: spacing.lg, gap: spacing.lg},
  date: {color: colors.textMuted, fontSize: 12, fontWeight: '600', marginBottom: 4},
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  greeting: {flex: 1, color: colors.text, fontSize: 25, fontWeight: '800', letterSpacing: -0.4},
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
    backgroundColor: 'rgba(231, 0, 11, 0.08)',
    color: colors.danger,
    fontSize: 13,
  },
  section: {gap: spacing.sm},
  sectionTitle: {color: colors.text, fontSize: 16, fontWeight: '600'},
  empty: {
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  emptyTitle: {color: colors.text, fontSize: 15, fontWeight: '600'},
  emptyBody: {color: colors.textMuted, fontSize: 13, lineHeight: 18},
  assignHero: {
    minHeight: 94,
    borderRadius: radius.lg,
    backgroundColor: '#4f3bf1',
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  assignHeroPressed: {opacity: 0.86},
  assignHeroDisabled: {opacity: 0.45},
  assignHeroIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  assignHeroIconText: {fontSize: 24, fontWeight: '800', color: '#ffffff'},
  assignHeroText: {flex: 1, gap: 3},
  assignHeroTitle: {fontSize: 17, fontWeight: '800', color: '#ffffff'},
  assignHeroCopy: {fontSize: 12, lineHeight: 17, color: '#e6e2ff'},
  assignHeroArrow: {fontSize: 24, fontWeight: '800', color: '#ffffff'},
  assignmentsList: {gap: spacing.md},
  classCard: {
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.md,
  },
  classCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  classBadge: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  classBadgeText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  classCardMeta: {flex: 1, gap: 2},
  classCardTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  classCardSubtitle: {
    color: colors.textMuted,
    fontSize: 12,
  },
  reportBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reportBtnText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  subjectsList: {gap: spacing.sm},
  subjectAccordion: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    overflow: 'hidden',
  },
  subjectAccordionOpen: {
    borderColor: colors.text,
  },
  subjectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm + 4,
    gap: spacing.sm,
  },
  subjectHeaderPressed: {
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
  },
  subjectIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subjectIconText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  subjectHeaderText: {flex: 1, gap: 1},
  subjectTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  subjectHint: {
    color: colors.textMuted,
    fontSize: 11,
  },
  countBadge: {
    minWidth: 26,
    height: 26,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  countBadgeText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  chevron: {
    width: 8,
    height: 8,
    borderRightWidth: 2,
    borderBottomWidth: 2,
    borderColor: colors.textMuted,
    transform: [{rotate: '-45deg'}],
    marginRight: 4,
  },
  chevronOpen: {
    transform: [{rotate: '45deg'}],
    borderColor: colors.text,
    marginTop: -4,
  },
  topicsContainer: {
    backgroundColor: colors.surfaceAlt,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: spacing.xs,
  },
  topicItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  topicItemBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  topicDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.text,
    marginTop: 6,
  },
  topicContent: {flex: 1, gap: 2},
  topicName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  topicMeta: {
    color: colors.textMuted,
    fontSize: 11,
  },
  classGroupLink: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  reteachCard: {
    backgroundColor: colors.bg,
    borderColor: colors.warning,
    borderWidth: 1,
    borderLeftWidth: 3,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  reteachHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reteachTitle: {color: colors.text, fontSize: 15, fontWeight: '700'},
  reteachTopics: {gap: spacing.xs},
  reteachTopicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  reteachTopicName: {flex: 1, color: colors.text, fontSize: 14},
  reteachTopicScore: {color: colors.warning, fontSize: 13, fontWeight: '700'},
});
