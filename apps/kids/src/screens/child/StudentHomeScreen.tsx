import React, {useMemo} from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';

import {useChildProfile} from '../../context/ChildProfileContext';
import {
  useChildClassId,
  useTodayAssignments,
  type AssignmentCard,
} from '../../firebase/study';
import {useAuthStore} from '../../state/authStore';
import {colors, radius, spacing} from '../../theme';

/**
 * Student landing screen.
 *
 * This deliberately consumes the production assignment subscription rather
 * than hard-coded subjects. A teacher assigning a topic through ZConnect
 * updates this screen automatically; tapping the CTA opens the existing
 * StudyNavigator, which owns the lesson and quiz flow.
 */
export function StudentHomeScreen() {
  const navigation = useNavigation<any>();
  const uid = useAuthStore(s => s.firebaseUid);
  const {childName} = useChildProfile();
  const classState = useChildClassId(uid);
  const assignmentsState = useTodayAssignments(classState.data?.classId ?? null);

  const assignments = assignmentsState.data ?? [];
  const firstName = childName.split(/\s+/)[0] || 'there';
  const salutation = useMemo(() => greetingForHour(new Date().getHours()), []);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.date}>{formatToday()}</Text>
        <Text style={styles.greeting}>
          {salutation}, {firstName}
        </Text>
        <Text style={styles.headerCopy}>
          Your teacher’s topics appear here when they are assigned.
        </Text>
      </View>

      <View style={styles.heroCard}>
        <Text style={styles.heroEyebrow}>TODAY’S LEARNING</Text>
        <Text style={styles.heroTitle}>
          {assignmentsState.loading
            ? 'Getting your topics ready…'
            : assignments.length === 0
              ? 'Nothing assigned yet'
              : `${assignments.length} topic${assignments.length === 1 ? '' : 's'} ready for you`}
        </Text>
        <Text style={styles.heroCopy}>
          {assignments.length === 0
            ? 'When your teacher assigns work, it will show up here automatically.'
            : 'Learn at your own pace, then take the quiz when you are ready.'}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate('StudyTab')}
          style={({pressed}) => [styles.heroButton, pressed && styles.pressed]}>
          <Text style={styles.heroButtonText}>
            {assignments.length > 0 ? 'Open today’s topics' : 'Open learning'}
          </Text>
          <Text style={styles.heroButtonArrow}>→</Text>
        </Pressable>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Today’s topics</Text>
        {assignments.length > 0 ? (
          <Pressable onPress={() => navigation.navigate('StudyTab')}>
            <Text style={styles.sectionAction}>See all</Text>
          </Pressable>
        ) : null}
      </View>

      {assignmentsState.loading ? (
        <View style={styles.loadingCard}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingText}>Loading assigned topics</Text>
        </View>
      ) : assignmentsState.error ? (
        <View style={styles.noticeCard}>
          <Text style={styles.noticeTitle}>Topics are temporarily unavailable</Text>
          <Text style={styles.noticeCopy}>Please check your connection and try again.</Text>
        </View>
      ) : assignments.length === 0 ? (
        <View style={styles.noticeCard}>
          <Text style={styles.noticeTitle}>Your day is clear</Text>
          <Text style={styles.noticeCopy}>
            There are no active topics assigned to your class today.
          </Text>
        </View>
      ) : (
        <View style={styles.topicList}>
          {assignments.slice(0, 3).map(assignment => (
            <TopicCard
              key={assignment.id}
              assignment={assignment}
              onPress={() => navigation.navigate('StudyTab')}
            />
          ))}
        </View>
      )}

      <View style={styles.assuranceCard}>
        <Text style={styles.assuranceIcon}>✦</Text>
        <View style={styles.assuranceText}>
          <Text style={styles.assuranceTitle}>Learning that follows your school</Text>
          <Text style={styles.assuranceCopy}>
            Topics, lessons and quizzes are assigned by your teacher.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

function TopicCard({assignment, onPress}: {assignment: AssignmentCard; onPress: () => void}) {
  const subject = subjectPresentation(assignment.subjectName);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({pressed}) => [styles.topicCard, pressed && styles.pressed]}>
      <View style={[styles.subjectIcon, {backgroundColor: subject.background}]}>
        <Text style={styles.subjectEmoji}>{subject.icon}</Text>
      </View>
      <View style={styles.topicText}>
        <Text style={styles.topicSubject}>{displaySubject(assignment.subjectName)}</Text>
        <Text style={styles.topicName} numberOfLines={1}>
          {assignment.topicName}
        </Text>
      </View>
      <Text style={styles.topicArrow}>→</Text>
    </Pressable>
  );
}

function subjectPresentation(subjectName: string) {
  const subject = subjectName.toLowerCase();
  if (subject.includes('math')) return {icon: '△', background: '#ebe7ff'};
  if (subject.includes('science')) return {icon: '◉', background: '#e8f6ff'};
  if (subject.includes('social')) return {icon: '◎', background: '#e9f8ef'};
  if (subject.includes('english') || subject.includes('language')) {
    return {icon: 'Aa', background: '#fff1df'};
  }
  return {icon: '✦', background: '#f0ecff'};
}

function displaySubject(subject: string) {
  return subject ? subject.charAt(0).toUpperCase() + subject.slice(1) : 'Learning';
}

function greetingForHour(hour: number) {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatToday() {
  return new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: colors.bg},
  content: {padding: spacing.lg, paddingBottom: spacing.xl, gap: spacing.lg},
  header: {gap: 5},
  date: {fontSize: 12, color: colors.textMuted, fontWeight: '600'},
  greeting: {fontSize: 28, color: colors.text, fontWeight: '800', letterSpacing: -0.5},
  headerCopy: {fontSize: 14, color: colors.textMuted, lineHeight: 20},
  heroCard: {
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  heroEyebrow: {fontSize: 11, fontWeight: '800', letterSpacing: 1, color: '#d9d2ff'},
  heroTitle: {fontSize: 25, lineHeight: 31, fontWeight: '800', color: colors.primaryText},
  heroCopy: {fontSize: 14, lineHeight: 20, color: '#e9e6ff'},
  heroButton: {
    marginTop: spacing.sm,
    minHeight: 50,
    borderRadius: radius.md,
    backgroundColor: '#ffffff',
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroButtonText: {fontSize: 15, fontWeight: '800', color: colors.primary},
  heroButtonArrow: {fontSize: 24, lineHeight: 24, fontWeight: '800', color: colors.primary},
  sectionHeader: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  sectionTitle: {fontSize: 19, fontWeight: '800', color: colors.text},
  sectionAction: {fontSize: 14, fontWeight: '800', color: colors.primary},
  topicList: {gap: spacing.sm},
  topicCard: {
    minHeight: 76,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  subjectIcon: {width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center'},
  subjectEmoji: {fontSize: 19, fontWeight: '800', color: colors.primary},
  topicText: {flex: 1, gap: 2},
  topicSubject: {fontSize: 14, fontWeight: '800', color: colors.text},
  topicName: {fontSize: 12, color: colors.textMuted},
  topicArrow: {fontSize: 24, lineHeight: 24, color: colors.primary, fontWeight: '800'},
  loadingCard: {minHeight: 112, alignItems: 'center', justifyContent: 'center', gap: spacing.sm},
  loadingText: {fontSize: 14, color: colors.textMuted},
  noticeCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  noticeTitle: {fontSize: 16, fontWeight: '800', color: colors.text},
  noticeCopy: {fontSize: 14, color: colors.textMuted, lineHeight: 20},
  assuranceCard: {
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: '#edeaff',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  assuranceIcon: {fontSize: 20, color: colors.primary},
  assuranceText: {flex: 1, gap: 3},
  assuranceTitle: {fontSize: 14, fontWeight: '800', color: colors.primary},
  assuranceCopy: {fontSize: 12, lineHeight: 18, color: '#595177'},
  pressed: {opacity: 0.82},
});
