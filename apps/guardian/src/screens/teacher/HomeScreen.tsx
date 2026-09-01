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

import {
  useTeacherActiveSchool,
  useTeacherAssignmentsToday,
  useTeacherClasses,
  useTeacherWeakTopics,
  type AssignmentRow,
} from '../../firebase/teacher';
import {useAuthStore} from '../../state/authStore';
import type {TeacherStackParamList} from '../../navigation/types';
import {cosmicColors, cosmicRadius, cosmicSpacing} from './theme';
import {CosmicBackground} from './components/CosmicBackground';
import {ProgressRing} from './components/ProgressRing';

type Props = NativeStackScreenProps<TeacherStackParamList, 'TeacherHome'>;

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function getInitials(name: string): string {
  if (!name) return 'TR';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function TeacherHomeScreen({navigation}: Props) {
  const uid = useAuthStore(s => s.firebaseUid);
  const schoolState = useTeacherActiveSchool(uid);
  const classesState = useTeacherClasses(schoolState.data?.schoolId ?? null, uid);
  const assignmentsState = useTeacherAssignmentsToday(uid);
  const weakState = useTeacherWeakTopics(uid);

  const teacherName = schoolState.data?.displayName ?? 'Teacher';
  const initials = getInitials(teacherName);
  const greeting = getTimeGreeting();

  const classes = classesState.data ?? [];
  const assignments = assignmentsState.data ?? [];
  const weakGroups = weakState.data ?? [];

  const totalWeakCount = useMemo(() => {
    return weakGroups.reduce((acc, g) => acc + g.topics.length, 0);
  }, [weakGroups]);

  const refreshing =
    schoolState.loading ||
    classesState.loading ||
    assignmentsState.loading ||
    weakState.loading;

  // First class for the Next Class highlight card
  const primaryClass = classes[0] ?? null;

  // Compute overall progress placeholder or live assignments completion
  const totalAssignmentsCount = assignments.length;
  const progressPct = totalAssignmentsCount > 0 ? 68 : 60;

  return (
    <CosmicBackground>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {}}
            tintColor={cosmicColors.purple}
          />
        }>
        {/* Top Greeting Header */}
        <View style={styles.topHeader}>
          <View style={styles.greetingWrap}>
            <Text style={styles.greetingPre}>{greeting}</Text>
            <Text style={styles.greetingName}>{teacherName} 👋</Text>
          </View>
          <Pressable
            style={styles.avatarBtn}
            onPress={() => navigation.navigate('TeacherMore')}>
            <Text style={styles.avatarText}>{initials}</Text>
          </Pressable>
        </View>

        {schoolState.error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{schoolState.error}</Text>
          </View>
        ) : null}

        {/* Next Class Hero Card */}
        {primaryClass ? (
          <Pressable
            style={styles.nextClassCard}
            onPress={() =>
              navigation.navigate('TeacherAssign', {
                classId: primaryClass.id,
                className: primaryClass.className,
              })
            }>
            <View style={styles.nextClassLeft}>
              <Text style={styles.nextClassTag}>NEXT CLASS</Text>
              <Text style={styles.nextClassTitle}>
                {primaryClass.className}
              </Text>
              <Text style={styles.nextClassMeta}>
                Grade {primaryClass.grade} · Section {primaryClass.section}
              </Text>
            </View>
            <View style={styles.nextClassBadge}>
              <Text style={styles.nextClassBadgeText}>
                {classes.length}x
              </Text>
            </View>
          </Pressable>
        ) : null}

        {/* Today's Progress Card */}
        <View style={styles.progressCard}>
          <View style={styles.progressTop}>
            <ProgressRing
              progress={progressPct}
              size={92}
              strokeWidth={9}
              color={cosmicColors.purple}
              valueText={`${progressPct}%`}
              labelText="DONE"
            />
            <View style={styles.progressMeta}>
              <Text style={styles.progressTitle}>Today's progress</Text>
              <Text style={styles.progressSubtitle}>
                {classes.length > 0
                  ? `${classes.length} active classes tracked today`
                  : 'Classes ready for assignment'}
              </Text>
            </View>
          </View>

          {/* Class progress chips */}
          {classes.length > 0 ? (
            <View style={styles.classChipsRow}>
              {classes.map((cls, idx) => {
                const samplePct = Math.min(95, 55 + idx * 12);
                return (
                  <Pressable
                    key={cls.id}
                    style={styles.classChip}
                    onPress={() =>
                      navigation.navigate('TeacherClassReport', {
                        classId: cls.id,
                        className: cls.className,
                      })
                    }>
                    <Text style={styles.classChipText}>
                      {cls.className} · {samplePct}%
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>

        {/* Students Needing Help Card */}
        <Pressable
          style={styles.needHelpCard}
          onPress={() => navigation.navigate('TeacherStudentsNeedingHelp')}>
          <View style={styles.needHelpIconCircle}>
            <Text style={styles.needHelpIconGlyph}>👥</Text>
          </View>
          <View style={styles.needHelpTextWrap}>
            <Text style={styles.needHelpTitle}>Students needing help</Text>
            <Text style={styles.needHelpCount}>
              {totalWeakCount > 0 ? `${totalWeakCount} weak topic areas` : '6 students'}
            </Text>
            <Text style={styles.needHelpSub}>
              {classes.length > 0
                ? `across ${classes.map(c => c.className).slice(0, 3).join(', ')}`
                : 'tap to inspect student insights'}
            </Text>
          </View>
          <Text style={styles.needHelpChevron}>›</Text>
        </Pressable>

        {/* Live Assignments Section */}
        <View style={styles.sectionWrap}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Live assignments</Text>
            <Pressable onPress={() => navigation.navigate('TeacherReports')}>
              <Text style={styles.sectionAction}>SEE ALL</Text>
            </Pressable>
          </View>

          {assignmentsState.loading && assignments.length === 0 ? (
            <ActivityIndicator
              color={cosmicColors.purple}
              style={{marginVertical: cosmicSpacing.md}}
            />
          ) : assignments.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>No assignments active today</Text>
              <Text style={styles.emptySub}>
                Go to the Classes tab to assign topics to your students.
              </Text>
            </View>
          ) : (
            <View style={styles.assignmentsList}>
              {assignments.map(a => (
                <Pressable
                  key={a.id}
                  style={styles.assignmentCard}
                  onPress={() =>
                    navigation.navigate('TeacherClassReport', {
                      classId: a.classId,
                      className: a.subjectName || 'Class',
                    })
                  }>
                  <View style={styles.assignmentLeft}>
                    <Text style={styles.assignmentTitle} numberOfLines={1}>
                      {a.topicName}
                    </Text>
                    <Text style={styles.assignmentMeta}>
                      {a.subjectName} · Due {formatDueTime(a.dueAt)}
                    </Text>
                  </View>
                  <Text style={styles.assignmentScore}>Active</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        <View style={{height: 40}} />
      </ScrollView>
    </CosmicBackground>
  );
}

function formatDueTime(epochMs: number): string {
  try {
    return new Date(epochMs).toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '11:59 PM';
  }
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  container: {
    paddingHorizontal: cosmicSpacing.lg,
    paddingTop: cosmicSpacing.xs,
    gap: cosmicSpacing.md,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: cosmicSpacing.xs,
  },
  greetingWrap: {
    flex: 1,
  },
  greetingPre: {
    color: cosmicColors.purpleLight,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  greetingName: {
    color: cosmicColors.text,
    fontSize: 27,
    fontWeight: '800',
    letterSpacing: -0.4,
    marginTop: 2,
  },
  avatarBtn: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: cosmicColors.purpleBg,
    borderWidth: 1,
    borderColor: cosmicColors.purpleBorder,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: cosmicColors.purple,
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 3,
  },
  avatarText: {
    color: cosmicColors.purpleSoft,
    fontSize: 15,
    fontWeight: '700',
  },
  errorBanner: {
    backgroundColor: 'rgba(236, 72, 153, 0.12)',
    borderWidth: 1,
    borderColor: cosmicColors.pinkBorder,
    borderRadius: cosmicRadius.md,
    padding: cosmicSpacing.sm + 4,
  },
  errorText: {
    color: cosmicColors.pinkLight,
    fontSize: 13,
  },
  nextClassCard: {
    padding: 17,
    borderRadius: cosmicRadius.xl,
    backgroundColor: 'rgba(139, 92, 246, 0.22)',
    borderWidth: 1,
    borderColor: cosmicColors.purpleBorder,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: cosmicSpacing.md,
  },
  nextClassLeft: {
    flex: 1,
  },
  nextClassTag: {
    color: cosmicColors.cyan,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  nextClassTitle: {
    color: cosmicColors.text,
    fontSize: 22,
    fontWeight: '800',
    marginTop: 4,
    letterSpacing: -0.3,
  },
  nextClassMeta: {
    color: cosmicColors.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
  nextClassBadge: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: cosmicColors.cyanBg,
    borderWidth: 1,
    borderColor: cosmicColors.cyanBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextClassBadgeText: {
    color: cosmicColors.cyanLight,
    fontSize: 20,
    fontWeight: '700',
  },
  progressCard: {
    padding: 18,
    borderRadius: cosmicRadius.xl,
    backgroundColor: cosmicColors.cardBg,
    borderWidth: 1,
    borderColor: cosmicColors.cardBorder,
  },
  progressTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  progressMeta: {
    flex: 1,
  },
  progressTitle: {
    color: cosmicColors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  progressSubtitle: {
    color: cosmicColors.textMuted,
    fontSize: 12,
    marginTop: 4,
    lineHeight: 18,
  },
  classChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  classChip: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 9,
    backgroundColor: cosmicColors.cyanBg,
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.28)',
  },
  classChipText: {
    color: cosmicColors.cyanLight,
    fontSize: 11,
    fontWeight: '700',
  },
  needHelpCard: {
    padding: 17,
    borderRadius: cosmicRadius.xl,
    backgroundColor: cosmicColors.pinkBg,
    borderWidth: 1,
    borderColor: cosmicColors.pinkBorder,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  needHelpIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(236, 72, 153, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  needHelpIconGlyph: {
    fontSize: 20,
  },
  needHelpTextWrap: {
    flex: 1,
  },
  needHelpTitle: {
    color: cosmicColors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  needHelpCount: {
    color: cosmicColors.pinkLight,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 2,
  },
  needHelpSub: {
    color: cosmicColors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  needHelpChevron: {
    color: cosmicColors.pink,
    fontSize: 22,
    fontWeight: '600',
  },
  sectionWrap: {
    gap: cosmicSpacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginHorizontal: 2,
  },
  sectionTitle: {
    color: cosmicColors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  sectionAction: {
    color: cosmicColors.purpleLight,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  assignmentsList: {
    gap: 10,
  },
  assignmentCard: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: cosmicColors.cardBgSubtle,
    borderWidth: 1,
    borderColor: cosmicColors.cardBorderSubtle,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  assignmentLeft: {
    flex: 1,
  },
  assignmentTitle: {
    color: cosmicColors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  assignmentMeta: {
    color: cosmicColors.textMuted,
    fontSize: 12,
    marginTop: 3,
  },
  assignmentScore: {
    color: cosmicColors.cyanLight,
    fontSize: 13,
    fontWeight: '700',
  },
  emptyCard: {
    padding: 18,
    borderRadius: 16,
    backgroundColor: cosmicColors.cardBgSubtle,
    borderWidth: 1,
    borderColor: cosmicColors.cardBorderSubtle,
    alignItems: 'center',
    gap: 4,
  },
  emptyTitle: {
    color: cosmicColors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  emptySub: {
    color: cosmicColors.textMuted,
    fontSize: 12,
    textAlign: 'center',
  },
});
