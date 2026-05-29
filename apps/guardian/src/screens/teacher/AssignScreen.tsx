import React, {useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {callFn} from '@zerebro/shared-firebase';

import {Button} from '../../components/Button';
import {
  defaultDueAtEpochMs,
  useChaptersForCurriculum,
  useCurriculaForGrade,
  useTeacherActiveSchool,
  useTeacherClasses,
  usePublishedTopics,
} from '../../firebase/teacher';
import {useAuthStore} from '../../state/authStore';
import {colors, radius, spacing} from '../../theme';
import type {TeacherStackParamList} from '../../navigation/types';

type Props = NativeStackScreenProps<TeacherStackParamList, 'TeacherAssign'>;

interface AssignTopicPayload {
  schoolId: string;
  classId: string;
  curriculumId: string;
  chapterId: string;
  topicId: string;
  dueAt: number;
}

interface AssignTopicResult {
  assignmentId: string;
  alreadyExisted: boolean;
}

/**
 * P4.5.2 -- cascading picker for assigning a curated topic.
 *
 * Flow: pick Class -> Subject (curriculum baked in) -> Chapter -> Topic
 * -> [optional] adjust dueAt (default today 23:59 local) -> Assign.
 *
 * Each picker is a vertical list of selectable cards. We avoid the
 * native <Picker> because it looks dramatically different across OEMs
 * and is fiddly to theme; cards are uniform, accessible, and let us
 * surface metadata (chapter no, topic count, etc.) inline.
 *
 * dueAt UX: P4.5 ships with a fixed default of today 23:59 local. A
 * future micro-task adds a +1d / +2d / "pick date" affordance; until
 * then a teacher who wants a longer due window cancels + re-assigns.
 * The 30-day server cap (apps/functions/src/callable/assignTopic.ts)
 * keeps the default sane.
 *
 * Error mapping: the `callFn` wrapper rethrows `FirebaseError`-shaped
 * errors with `.code` like `'functions/permission-denied'`. We strip
 * the `'functions/'` prefix for cleaner UI copy.
 */
export function TeacherAssignScreen({navigation}: Props) {
  const uid = useAuthStore(s => s.firebaseUid);
  const schoolState = useTeacherActiveSchool(uid);

  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedCurriculumId, setSelectedCurriculumId] = useState<string | null>(null);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [dueAt, setDueAt] = useState<number>(defaultDueAtEpochMs());
  const [submitting, setSubmitting] = useState(false);

  const classesState = useTeacherClasses(schoolState.data?.schoolId ?? null, uid);

  const selectedClass = useMemo(
    () => (classesState.data ?? []).find(c => c.id === selectedClassId) ?? null,
    [classesState.data, selectedClassId],
  );
  const curriculaState = useCurriculaForGrade(selectedClass?.grade ?? null);

  const chaptersState = useChaptersForCurriculum(selectedCurriculumId);
  const topicsState = usePublishedTopics(selectedCurriculumId, selectedChapterId);

  useEffect(() => {
    setSelectedCurriculumId(null);
    setSelectedChapterId(null);
    setSelectedTopicId(null);
  }, [selectedClassId]);
  useEffect(() => {
    setSelectedChapterId(null);
    setSelectedTopicId(null);
  }, [selectedCurriculumId]);
  useEffect(() => {
    setSelectedTopicId(null);
  }, [selectedChapterId]);

  const canSubmit =
    !!schoolState.data &&
    !!selectedClassId &&
    !!selectedCurriculumId &&
    !!selectedChapterId &&
    !!selectedTopicId &&
    !submitting;

  async function onAssign() {
    if (
      !schoolState.data ||
      !selectedClassId ||
      !selectedCurriculumId ||
      !selectedChapterId ||
      !selectedTopicId
    ) {
      Alert.alert('Pick a topic first', 'Choose class, subject, chapter, and topic.');
      return;
    }
    setSubmitting(true);
    try {
      const out = await callFn<AssignTopicPayload, AssignTopicResult>(
        'assignTopic',
        {
          schoolId: schoolState.data.schoolId,
          classId: selectedClassId,
          curriculumId: selectedCurriculumId,
          chapterId: selectedChapterId,
          topicId: selectedTopicId,
          dueAt,
        },
      );
      Alert.alert(
        'Assigned',
        `Students will see the new topic in their Study Mission within a few seconds.`,
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ],
      );
      console.log('assignTopic ok', out);
    } catch (err) {
      Alert.alert('Could not assign', humanise(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (schoolState.loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (!schoolState.data) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>No active school</Text>
        <Text style={styles.bodyMuted}>
          Your teacher account isn't active in any school yet. Ask your
          principal to approve your request, then come back.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <Section
        title="Class"
        loading={classesState.loading}
        error={classesState.error}
        emptyCopy="No classes assigned to you yet. Ask your principal to add you to a class first.">
        {(classesState.data ?? []).map(c => (
          <PickerRow
            key={c.id}
            label={`Class ${c.className}`}
            sublabel={`Grade ${c.grade} • Section ${c.section}`}
            selected={selectedClassId === c.id}
            onPress={() => setSelectedClassId(c.id)}
          />
        ))}
      </Section>

      {selectedClassId ? (
        <Section
          title="Subject"
          loading={curriculaState.loading}
          error={curriculaState.error}
          emptyCopy="No curriculum available for this grade yet.">
          {(curriculaState.data ?? []).map(s => (
            <PickerRow
              key={s.id}
              label={s.subject.charAt(0).toUpperCase() + s.subject.slice(1)}
              sublabel={`Board: ${s.board.toUpperCase()}`}
              selected={selectedCurriculumId === s.id}
              onPress={() => setSelectedCurriculumId(s.id)}
            />
          ))}
        </Section>
      ) : null}

      {selectedCurriculumId ? (
        <Section
          title="Chapter"
          loading={chaptersState.loading}
          error={chaptersState.error}
          emptyCopy="No published chapters yet. Ask an admin to import content.">
          {(chaptersState.data ?? []).map(c => (
            <PickerRow
              key={c.id}
              label={`Ch ${c.chapterNo}. ${c.chapterName}`}
              selected={selectedChapterId === c.id}
              onPress={() => setSelectedChapterId(c.id)}
            />
          ))}
        </Section>
      ) : null}

      {selectedChapterId ? (
        <Section
          title="Topic"
          loading={topicsState.loading}
          error={topicsState.error}
          emptyCopy="No published topics in this chapter yet.">
          {(topicsState.data ?? []).map(t => (
            <PickerRow
              key={t.id}
              label={t.topicName}
              selected={selectedTopicId === t.id}
              onPress={() => setSelectedTopicId(t.id)}
            />
          ))}
        </Section>
      ) : null}

      {selectedTopicId ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Due</Text>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{formatDueAt(dueAt)}</Text>
            <Text style={styles.bodyMuted}>
              Default: today at 11:59 PM in your school's timezone. (Editable
              due-date picker coming next.)
            </Text>
          </View>
        </View>
      ) : null}

      <View style={{height: spacing.lg}} />

      <Button
        title={submitting ? 'Assigning…' : 'Assign'}
        onPress={onAssign}
        disabled={!canSubmit}
        loading={submitting}
      />
    </ScrollView>
  );
}

interface SectionProps {
  title: string;
  loading: boolean;
  error: string | null;
  emptyCopy: string;
  children: React.ReactNode;
}

function Section({title, loading, error, emptyCopy, children}: SectionProps) {
  const childCount = React.Children.count(children);
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {loading ? (
        <ActivityIndicator color={colors.primary} />
      ) : error ? (
        <Text style={styles.errorBanner}>{error}</Text>
      ) : childCount === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.bodyMuted}>{emptyCopy}</Text>
        </View>
      ) : (
        <View style={{gap: spacing.xs}}>{children}</View>
      )}
    </View>
  );
}

function PickerRow({
  label,
  sublabel,
  selected,
  onPress,
}: {
  label: string;
  sublabel?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{color: 'rgba(255,255,255,0.06)'}}
      style={[styles.row, selected && styles.rowSelected]}
      accessibilityRole="button"
      accessibilityState={{selected}}>
      <View style={{flex: 1}}>
        <Text style={styles.rowLabel}>{label}</Text>
        {sublabel ? <Text style={styles.rowSublabel}>{sublabel}</Text> : null}
      </View>
      {selected ? <Text style={styles.check}>✓</Text> : null}
    </Pressable>
  );
}

function formatDueAt(epochMs: number): string {
  try {
    return new Date(epochMs).toLocaleString(undefined, {
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

function humanise(err: unknown): string {
  const e = err as {code?: string; message?: string} | null;
  const code =
    typeof e?.code === 'string'
      ? e.code.replace(/^functions\//, '')
      : 'unknown';
  const message = e?.message ?? 'Something went wrong.';
  // Surface the server's message verbatim for known error codes -- our
  // callable's error copy is already user-friendly.
  if (
    code === 'invalid-argument' ||
    code === 'failed-precondition' ||
    code === 'permission-denied' ||
    code === 'not-found' ||
    code === 'unauthenticated'
  ) {
    return message;
  }
  return `${message} (${code})`;
}

const styles = StyleSheet.create({
  scroll: {flex: 1, backgroundColor: colors.bg},
  container: {padding: spacing.lg, gap: spacing.lg},
  centered: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  errorTitle: {color: colors.text, fontSize: 18, fontWeight: '700'},
  section: {gap: spacing.sm},
  sectionTitle: {
    color: colors.textMuted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rowSelected: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
  },
  rowLabel: {color: colors.text, fontSize: 15, fontWeight: '600'},
  rowSublabel: {color: colors.textMuted, fontSize: 12, marginTop: 2},
  check: {color: colors.primary, fontSize: 18, fontWeight: '700'},
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  cardTitle: {color: colors.text, fontSize: 15, fontWeight: '600'},
  bodyMuted: {color: colors.textMuted, fontSize: 13, lineHeight: 18},
  emptyCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  errorBanner: {
    padding: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(248, 113, 113, 0.12)',
    color: colors.danger,
    fontSize: 13,
  },
});
