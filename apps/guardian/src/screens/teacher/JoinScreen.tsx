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
import firestore from '@react-native-firebase/firestore';

import {callFn} from '@zerebro/shared-firebase';
import {signOut} from '@zerebro/shared-firebase/auth';

import {Button} from '../../components/Button';
import {Screen} from '../../components/Screen';
import {TextInput} from '../../components/TextInput';
import {useAuthStore} from '../../state/authStore';
import {colors, radius, spacing} from '../../theme';

/**
 * P4.3 -- the teacher-side onboarding screen.
 *
 * Three-phase flow:
 *   1. Enter teacher code + name -> "Verify code" calls `lookupSchoolClasses`.
 *   2. Pick class(es) and subject(s) per class (with already-taken subjects
 *      shown as unavailable).
 *   3. "Submit for approval" calls `requestTeacherJoin` with `classSubjects`.
 */

interface ClassSummary {
  id: string;
  className: string;
  grade: number;
  section: string;
  subjectTeachers: Record<string, string>;
}

interface CurriculumSummary {
  id: string;
  subject: string;
  grade: number;
  board: string;
}

interface LookupResult {
  schoolId: string;
  schoolName: string;
  classes: ClassSummary[];
  curricula: CurriculumSummary[];
}

interface ClassSubjectSelection {
  classId: string;
  curriculumId: string;
}

export function TeacherJoinScreen({onBack}: {onBack: () => void}) {
  const uid = useAuthStore(s => s.firebaseUid);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<{
    schoolId: string;
    teacherId: string;
  } | null>(null);
  const [rejection, setRejection] = useState<string | null>(null);

  const [lookup, setLookup] = useState<LookupResult | null>(null);
  const [selections, setSelections] = useState<ClassSubjectSelection[]>([]);

  useEffect(() => {
    if (!uid) return;
    const unsub = firestore()
      .collectionGroup('teachers')
      .where('userId', '==', uid)
      .limit(1)
      .onSnapshot(
        snap => {
          const docSnap = snap.docs[0];
          if (!docSnap) {
            setPending(null);
            return;
          }
          const data = docSnap.data() as {
            status?: 'pending' | 'active' | 'rejected';
            rejectedReason?: string;
          };
          if (data.status === 'pending') {
            const schoolId = docSnap.ref.parent.parent?.id;
            if (schoolId) {
              setPending({schoolId, teacherId: docSnap.id});
              setRejection(null);
            }
          } else if (data.status === 'rejected') {
            setPending(null);
            setRejection(data.rejectedReason ?? 'Your request was rejected.');
          }
        },
        err => console.warn('teacher pending listener', err),
      );
    return unsub;
  }, [uid]);

  async function onVerifyCode() {
    const trimmedCode = code.trim().toUpperCase();
    const trimmedName = name.trim();
    if (trimmedCode.length === 0) {
      Alert.alert('Missing code', 'Enter the code your principal shared.');
      return;
    }
    if (trimmedName.length < 2) {
      Alert.alert('Missing name', 'Enter your full name.');
      return;
    }
    try {
      setLoading(true);
      const result = await callFn<
        {teacherCode: string},
        LookupResult
      >('lookupSchoolClasses', {teacherCode: trimmedCode});
      setLookup(result);
      setSelections([]);
    } catch (err) {
      Alert.alert(
        'Invalid code',
        (err as {message?: string} | null)?.message ??
          'Code is incorrect or has been rotated.',
      );
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit() {
    if (!lookup) return;
    if (selections.length === 0) {
      Alert.alert(
        'Select subjects',
        'Pick at least one subject in a class before submitting.',
      );
      return;
    }
    try {
      setLoading(true);
      const out = await callFn<
        {
          teacherCode: string;
          displayName: string;
          classSubjects: ClassSubjectSelection[];
        },
        {schoolId: string; teacherId: string; status: string}
      >('requestTeacherJoin', {
        teacherCode: code.trim().toUpperCase(),
        displayName: name.trim(),
        classSubjects: selections,
      });
      setPending({schoolId: out.schoolId, teacherId: out.teacherId});
      setRejection(null);
    } catch (err) {
      Alert.alert(
        'Could not submit',
        (err as {message?: string} | null)?.message ??
          'Something went wrong. Try again.',
      );
    } finally {
      setLoading(false);
    }
  }

  function toggleSubject(classId: string, curriculumId: string) {
    setSelections(prev => {
      const exists = prev.some(
        s => s.classId === classId && s.curriculumId === curriculumId,
      );
      if (exists) {
        return prev.filter(
          s => !(s.classId === classId && s.curriculumId === curriculumId),
        );
      }
      return [...prev, {classId, curriculumId}];
    });
  }

  function isSelected(classId: string, curriculumId: string): boolean {
    return selections.some(
      s => s.classId === classId && s.curriculumId === curriculumId,
    );
  }

  // Group curricula by grade for easy lookup
  const curriculaByGrade = useMemo(() => {
    if (!lookup) return new Map<number, CurriculumSummary[]>();
    const m = new Map<number, CurriculumSummary[]>();
    for (const c of lookup.curricula) {
      const list = m.get(c.grade) ?? [];
      list.push(c);
      m.set(c.grade, list);
    }
    return m;
  }, [lookup]);

  // Check if any class has a selected subject
  const hasClassSelection = useMemo(() => {
    const classIds = new Set(selections.map(s => s.classId));
    return classIds.size > 0;
  }, [selections]);

  if (pending) {
    return <PendingView onSignOut={() => signOut().catch(() => {})} />;
  }

  // Phase 2: class + subject selection
  if (lookup) {
    return (
      <Screen
        title="Select your classes & subjects"
        subtitle={`School: ${lookup.schoolName || 'Your school'}`}
        scroll={false}>
        <Text style={styles.selectHint}>
          For each class, tap the subject(s) you teach. Subjects already
          assigned to another teacher are shown as taken.
        </Text>

        <ScrollView style={styles.classList} nestedScrollEnabled>
          {lookup.classes.length === 0 ? (
            <Text style={styles.emptyText}>
              No classes found. Ask your principal to create classes first.
            </Text>
          ) : (
            lookup.classes.map(cls => {
              const subjects = curriculaByGrade.get(cls.grade) ?? [];
              return (
                <View key={cls.id} style={styles.classBlock}>
                  <Text style={styles.classHeader}>
                    {cls.className} (Grade {cls.grade}{cls.section})
                  </Text>
                  {subjects.length === 0 ? (
                    <Text style={styles.noSubjects}>
                      No subjects available for grade {cls.grade}
                    </Text>
                  ) : (
                    subjects.map(subj => {
                      const takenBy = cls.subjectTeachers[subj.id];
                      const isTaken = !!takenBy && takenBy !== uid;
                      const selected = isSelected(cls.id, subj.id);
                      return (
                        <Pressable
                          key={subj.id}
                          onPress={() =>
                            !isTaken && toggleSubject(cls.id, subj.id)
                          }
                          disabled={isTaken}
                          style={[
                            styles.subjectCard,
                            selected && styles.subjectCardSelected,
                            isTaken && styles.subjectCardTaken,
                          ]}>
                          <View style={styles.checkbox}>
                            {selected ? (
                              <View style={styles.checkboxFilled} />
                            ) : null}
                          </View>
                          <View style={styles.subjectInfo}>
                            <Text
                              style={[
                                styles.subjectName,
                                isTaken && styles.subjectNameTaken,
                              ]}>
                              {subj.subject.charAt(0).toUpperCase() +
                                subj.subject.slice(1)}
                            </Text>
                            {isTaken ? (
                              <Text style={styles.takenLabel}>
                                Taken by another teacher
                              </Text>
                            ) : null}
                          </View>
                        </Pressable>
                      );
                    })
                  )}
                </View>
              );
            })
          )}
        </ScrollView>

        <View style={styles.actionRow}>
          <Button
            title="Submit for approval"
            onPress={onSubmit}
            loading={loading}
            disabled={selections.length === 0}
          />
          <Pressable
            onPress={() => {
              setLookup(null);
              setSelections([]);
            }}>
            <Text style={styles.linkMuted}>Change code</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  // Phase 1: code + name entry
  return (
    <Screen
      title="Join your school"
      subtitle="Enter the 6-character code your principal shared with you.">
      {rejection ? (
        <View style={styles.banner}>
          <Text style={styles.bannerTitle}>Your last request was rejected</Text>
          <Text style={styles.bannerBody}>{rejection}</Text>
          <Text style={styles.bannerBody}>
            Ask your principal for a fresh code and try again.
          </Text>
        </View>
      ) : null}

      <TextInput
        label="Teacher code"
        autoCapitalize="characters"
        autoCorrect={false}
        value={code}
        onChangeText={t => setCode(t.toUpperCase())}
        placeholder="ABCDEF"
        maxLength={6}
        style={styles.codeInput}
      />
      <TextInput
        label="Your full name"
        autoCapitalize="words"
        value={name}
        onChangeText={setName}
        placeholder="e.g. Priya Sharma"
      />

      <Button title="Verify code" onPress={onVerifyCode} loading={loading} />

      <Pressable onPress={onBack}>
        <Text style={styles.linkMuted}>Back to options</Text>
      </Pressable>
    </Screen>
  );
}

function PendingView({onSignOut}: {onSignOut: () => void}) {
  return (
    <View style={styles.pendingContainer}>
      <ActivityIndicator color={colors.primary} size="large" />
      <Text style={styles.pendingTitle}>Waiting for principal approval</Text>
      <Text style={styles.pendingBody}>
        Your request is in your principal's queue. The moment they approve
        it, ZConnect will switch you to the Teacher home automatically --
        no need to refresh or restart.
      </Text>
      <Pressable
        accessibilityRole="button"
        style={styles.signOut}
        onPress={onSignOut}>
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  codeInput: {
    fontSize: 22,
    letterSpacing: 4,
    textAlign: 'center',
  },
  linkMuted: {
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
  banner: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: 'rgba(231, 0, 11, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(231, 0, 11, 0.2)',
    gap: spacing.xs,
  },
  bannerTitle: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: '700',
  },
  bannerBody: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  selectHint: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  classList: {
    flex: 1,
  },
  classBlock: {
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  classHeader: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  noSubjects: {
    color: colors.textMuted,
    fontSize: 13,
    fontStyle: 'italic',
    paddingLeft: spacing.sm,
  },
  subjectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  subjectCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceAlt,
  },
  subjectCardTaken: {
    opacity: 0.5,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxFilled: {
    width: 14,
    height: 14,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
  subjectInfo: {
    flex: 1,
  },
  subjectName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  subjectNameTaken: {
    color: colors.textMuted,
  },
  takenLabel: {
    color: colors.danger,
    fontSize: 12,
    marginTop: 2,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
  actionRow: {
    gap: spacing.md,
    marginTop: spacing.md,
  },
  pendingContainer: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: spacing.xl,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  pendingTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: spacing.md,
  },
  pendingBody: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 360,
  },
  signOut: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  signOutText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
});
