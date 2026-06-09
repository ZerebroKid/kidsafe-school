import React, {useCallback, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {
  chapterMetaKey,
  compareTopicOrder,
  useChildClassId,
  useChapterMetaMap,
  useTodayAssignments,
  type AssignmentCard,
  type ChapterMeta,
} from '../../firebase/study';
import {useAuthStore} from '../../state/authStore';
import {colors, radius, spacing} from '../../theme';
import type {StudyStackParamList} from '../../navigation/types';

type Props = NativeStackScreenProps<StudyStackParamList, 'StudyMission'>;

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface ChapterGroup {
  curriculumId: string;
  chapterId: string;
  chapterLabel: string;
  topics: AssignmentCard[];
}

interface SubjectGroup {
  subjectName: string;
  subjectLabel: string;
  chapters: ChapterGroup[];
  topicCount: number;
}

export function StudyMissionScreen({navigation}: Props) {
  const uid = useAuthStore(s => s.firebaseUid);
  const classState = useChildClassId(uid);
  const assignmentsState = useTodayAssignments(classState.data?.classId ?? null);

  const assignments = assignmentsState.data ?? [];
  const chapterMetaState = useChapterMetaMap(assignmentsState.data);
  const chapterMeta = chapterMetaState.data ?? {};
  const subjectGroups = useMemo(
    () => groupBySubjectAndChapter(assignments, chapterMeta),
    [assignments, chapterMeta],
  );

  const openTopic = useCallback(
    (a: AssignmentCard) => {
      navigation.navigate('TopicLearn', {
        assignmentId: a.id,
        curriculumId: a.curriculumId,
        chapterId: a.chapterId,
        topicId: a.topicId,
        topicName: a.topicName,
      });
    },
    [navigation],
  );

  if (classState.loading || assignmentsState.loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading your study mission…</Text>
      </View>
    );
  }

  if (classState.error || assignmentsState.error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorEmoji}>⚠️</Text>
        <Text style={styles.errorTitle}>Something went wrong</Text>
        <Text style={styles.errorBody}>
          {classState.error || assignmentsState.error}
        </Text>
      </View>
    );
  }

  if (!classState.data) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyEmoji}>🏫</Text>
        <Text style={styles.emptyTitle}>Join a school first</Text>
        <Text style={styles.emptyBody}>
          Ask your parent for the school code to get started.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Today's Study Mission</Text>
      <Text style={styles.subheading}>
        {assignments.length === 0
          ? 'No assignments yet'
          : `${assignments.length} topic${assignments.length > 1 ? 's' : ''} to learn`}
      </Text>

      {assignments.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyEmoji}>📚</Text>
          <Text style={styles.emptyTitle}>No assignments today</Text>
          <Text style={styles.emptyBody}>
            Your teacher hasn't assigned any topics yet. Check back later!
          </Text>
        </View>
      ) : (
        <View style={styles.subjectList}>
          {subjectGroups.map(subject => (
            <SubjectSection
              key={subject.subjectName}
              subject={subject}
              onOpenTopic={openTopic}
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function SubjectSection({
  subject,
  onOpenTopic,
}: {
  subject: SubjectGroup;
  onOpenTopic: (a: AssignmentCard) => void;
}) {
  return (
    <View style={styles.subjectSection}>
      <View style={styles.subjectHeader}>
        <Text style={styles.subjectTitle}>{subject.subjectLabel}</Text>
        <Text style={styles.subjectCount}>
          {subject.topicCount} topic{subject.topicCount > 1 ? 's' : ''}
        </Text>
      </View>
      <View style={styles.chapterList}>
        {subject.chapters.map(chapter => (
          <ChapterAccordion
            key={chapterMetaKey(chapter.curriculumId, chapter.chapterId)}
            chapter={chapter}
            onOpenTopic={onOpenTopic}
          />
        ))}
      </View>
    </View>
  );
}

function ChapterAccordion({
  chapter,
  onOpenTopic,
}: {
  chapter: ChapterGroup;
  onOpenTopic: (a: AssignmentCard) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const toggle = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(prev => !prev);
  }, []);

  return (
    <View style={styles.chapterCard}>
      <Pressable
        onPress={toggle}
        android_ripple={{color: 'rgba(0,0,0,0.04)'}}
        style={styles.chapterRow}>
        <View style={styles.chapterInfo}>
          <Text style={styles.chapterLabel}>{chapter.chapterLabel}</Text>
          <Text style={styles.chapterMeta}>
            {chapter.topics.length} topic
            {chapter.topics.length > 1 ? 's' : ''}
          </Text>
        </View>
        <Text style={styles.chevron}>{expanded ? '▲' : '▼'}</Text>
      </Pressable>

      {expanded ? (
        <View style={styles.topicList}>
          {chapter.topics.map(topic => (
            <Pressable
              key={topic.id}
              onPress={() => onOpenTopic(topic)}
              android_ripple={{color: 'rgba(0,0,0,0.04)'}}
              style={styles.topicRow}>
              <View style={styles.topicInfo}>
                <Text style={styles.topicName}>{topic.topicName}</Text>
                <Text style={styles.dueText}>Due {formatDueTime(topic.dueAt)}</Text>
              </View>
              <Text style={styles.topicCta}>▶</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function groupBySubjectAndChapter(
  assignments: AssignmentCard[],
  chapterMeta: Record<string, ChapterMeta>,
): SubjectGroup[] {
  const subjectMap = new Map<
    string,
    Map<string, {curriculumId: string; chapterId: string; topics: AssignmentCard[]}>
  >();

  for (const a of assignments) {
    const subjectKey = a.subjectName || 'Other';
    if (!subjectMap.has(subjectKey)) {
      subjectMap.set(subjectKey, new Map());
    }
    const chapterMap = subjectMap.get(subjectKey)!;
    const chapterKey = chapterMetaKey(a.curriculumId, a.chapterId);
    if (!chapterMap.has(chapterKey)) {
      chapterMap.set(chapterKey, {
        curriculumId: a.curriculumId,
        chapterId: a.chapterId,
        topics: [],
      });
    }
    chapterMap.get(chapterKey)!.topics.push(a);
  }

  const subjects: SubjectGroup[] = [];
  for (const [subjectName, chapterMap] of subjectMap) {
    const chapters: ChapterGroup[] = [];
    let topicCount = 0;
    for (const {curriculumId, chapterId, topics} of chapterMap.values()) {
      topics.sort(compareTopicOrder);
      topicCount += topics.length;
      chapters.push({
        curriculumId,
        chapterId,
        chapterLabel: formatChapterLabel(curriculumId, chapterId, chapterMeta),
        topics,
      });
    }
    chapters.sort((x, y) => {
      const mx = chapterMeta[chapterMetaKey(x.curriculumId, x.chapterId)];
      const my = chapterMeta[chapterMetaKey(y.curriculumId, y.chapterId)];
      if (mx && my) return mx.chapterNo - my.chapterNo;
      return x.chapterLabel.localeCompare(y.chapterLabel);
    });
    subjects.push({
      subjectName,
      subjectLabel: capitalize(subjectName),
      chapters,
      topicCount,
    });
  }
  subjects.sort((x, y) => x.subjectLabel.localeCompare(y.subjectLabel));
  return subjects;
}

function formatChapterLabel(
  curriculumId: string,
  chapterId: string,
  chapterMeta: Record<string, ChapterMeta>,
): string {
  const meta = chapterMeta[chapterMetaKey(curriculumId, chapterId)];
  if (meta) {
    return `Ch ${meta.chapterNo}. ${meta.chapterName}`;
  }
  return prettifyId(chapterId);
}

function prettifyId(id: string): string {
  return id
    .split(/[_-]/)
    .filter(Boolean)
    .map(capitalize)
    .join(' ');
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function formatDueTime(epochMs: number): string {
  try {
    return new Date(epochMs).toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

const styles = StyleSheet.create({
  scroll: {flex: 1, backgroundColor: colors.bg},
  container: {padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl},
  centered: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  subheading: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  loadingText: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  subjectList: {gap: spacing.lg},
  subjectSection: {gap: spacing.sm},
  subjectHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  subjectTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  subjectCount: {
    fontSize: 12,
    color: colors.textMuted,
  },
  chapterList: {gap: spacing.sm},
  chapterCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  chapterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  chapterInfo: {
    flex: 1,
    gap: 2,
  },
  chapterLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  chapterMeta: {
    fontSize: 12,
    color: colors.textMuted,
  },
  chevron: {
    fontSize: 10,
    color: colors.textMuted,
    marginLeft: spacing.sm,
  },
  topicList: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  topicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  topicInfo: {
    flex: 1,
    gap: 2,
  },
  topicName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    lineHeight: 21,
  },
  dueText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  topicCta: {
    fontSize: 14,
    color: colors.text,
    marginLeft: spacing.sm,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  emptyEmoji: {fontSize: 48},
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  emptyBody: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  errorEmoji: {fontSize: 40},
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.danger,
  },
  errorBody: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
