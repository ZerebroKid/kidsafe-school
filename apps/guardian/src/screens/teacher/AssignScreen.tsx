import React, {useCallback, useEffect, useMemo, useState} from 'react';
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
import {
  defaultDueAtEpochMs,
  useChaptersForCurriculum,
  useCurriculaForGrade,
  usePublishedTopics,
  useTeacherActiveSchool,
  useTeacherClasses,
  type ChapterRow,
  type ClassRow,
  type CurriculumRow,
  type TopicRow,
} from '../../firebase/teacher';
import {useAuthStore} from '../../state/authStore';
import type {TeacherStackParamList} from '../../navigation/types';
import {cosmicColors, cosmicRadius, cosmicSpacing} from './theme';
import {CosmicBackground} from './components/CosmicBackground';
import {CosmicHeader} from './components/CosmicHeader';

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

const QUESTION_COUNTS = [5, 10, 15, 20];
const DUE_OPTIONS = [
  {label: 'Today', sub: '11:59 PM', daysOffset: 0},
  {label: 'Tomorrow', sub: '11:59 PM', daysOffset: 1},
  {label: 'In 3 days', sub: '11:59 PM', daysOffset: 3},
];

function humanise(err: unknown): string {
  const e = err as {code?: string; message?: string} | null;
  const code =
    typeof e?.code === 'string'
      ? e.code.replace(/^functions\//, '')
      : 'unknown';
  const message = e?.message ?? 'Something went wrong.';
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

interface SelectedTopicItem {
  id: string;
  name: string;
  chapterId: string;
  chapterName?: string;
}

export function TeacherAssignScreen({route, navigation}: Props) {
  const params = route.params ?? {};
  const uid = useAuthStore(s => s.firebaseUid);

  // 1. Resolve teacher's active school
  const schoolState = useTeacherActiveSchool(uid);
  const schoolId = schoolState.data?.schoolId ?? null;

  // 2. Resolve classes taught by this teacher
  const classesState = useTeacherClasses(schoolId, uid);
  const classes = classesState.data ?? [];

  // Selected state
  const [selectedClassId, setSelectedClassId] = useState<string | null>(
    () => params.classId ?? null,
  );
  const [selectedCurriculumId, setSelectedCurriculumId] = useState<
    string | null
  >(() => params.curriculumId ?? null);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(
    () => params.chapterId ?? null,
  );
  const [selectedTopicsMap, setSelectedTopicsMap] = useState<
    Map<string, SelectedTopicItem>
  >(() => {
    const map = new Map<string, SelectedTopicItem>();
    if (params.initialTopics && params.initialTopics.length > 0) {
      for (const t of params.initialTopics) {
        map.set(t.id, {
          id: t.id,
          name: t.name,
          chapterId: t.chapterId || params.chapterId || '',
          chapterName: t.chapterName || params.chapterName,
        });
      }
    }
    return map;
  });

  const [qCountIdx, setQCountIdx] = useState(1); // Default 10
  const [dueIdx, setDueIdx] = useState(0); // Default Today
  const [submitting, setSubmitting] = useState(false);

  const selectedTopicsList = useMemo(
    () => Array.from(selectedTopicsMap.values()),
    [selectedTopicsMap],
  );

  // Sync initial class selection when classes load
  useEffect(() => {
    if (!selectedClassId && classes.length > 0) {
      setSelectedClassId(params.classId ?? classes[0].id);
    }
  }, [classes, selectedClassId, params.classId]);

  const selectedClass: ClassRow | null = useMemo(() => {
    if (!selectedClassId) return null;
    return classes.find(c => c.id === selectedClassId) ?? null;
  }, [classes, selectedClassId]);

  // 3. Resolve curricula for selected class grade
  const allCurriculaState = useCurriculaForGrade(selectedClass?.grade ?? null);

  // 4. Filter subjects: if subjectTeachers exists, keep only where subjectTeachers[curriculumId] === uid
  const curricula: CurriculumRow[] = useMemo(() => {
    const all = allCurriculaState.data ?? [];
    const st = selectedClass?.subjectTeachers;
    if (!st || Object.keys(st).length === 0) {
      return all;
    }
    return all.filter(c => st[c.id] === uid);
  }, [allCurriculaState.data, selectedClass?.subjectTeachers, uid]);

  // Keep curriculum selection in sync if current selectedCurriculumId is invalid
  useEffect(() => {
    if (selectedCurriculumId && curricula.length > 0) {
      if (!curricula.some(c => c.id === selectedCurriculumId)) {
        setSelectedCurriculumId(null);
      }
    } else if (params.curriculumId && curricula.some(c => c.id === params.curriculumId)) {
      setSelectedCurriculumId(params.curriculumId);
    }
  }, [curricula, selectedCurriculumId, params.curriculumId]);

  const selectedCurriculum: CurriculumRow | null = useMemo(() => {
    if (!selectedCurriculumId) return null;
    return curricula.find(c => c.id === selectedCurriculumId) ?? null;
  }, [curricula, selectedCurriculumId]);

  // 5. Resolve published chapters for selected curriculum
  const chaptersState = useChaptersForCurriculum(selectedCurriculumId);
  const chapters: ChapterRow[] = chaptersState.data ?? [];

  // Keep chapter selection in sync if current selectedChapterId is invalid
  useEffect(() => {
    if (selectedChapterId && chapters.length > 0) {
      if (!chapters.some(c => c.id === selectedChapterId)) {
        setSelectedChapterId(null);
      }
    } else if (params.chapterId && chapters.some(c => c.id === params.chapterId)) {
      setSelectedChapterId(params.chapterId);
    }
  }, [chapters, selectedChapterId, params.chapterId]);

  const selectedChapter: ChapterRow | null = useMemo(() => {
    if (!selectedChapterId) return null;
    return chapters.find(c => c.id === selectedChapterId) ?? null;
  }, [chapters, selectedChapterId]);

  // 6. Resolve published topics for selected chapter
  const topicsState = usePublishedTopics(
    selectedCurriculumId,
    selectedChapterId,
  );
  const topics: TopicRow[] = topicsState.data ?? [];

  // Cascading Selection Handlers
  const handleSelectClass = useCallback(
    (classId: string) => {
      if (classId === selectedClassId) return;
      setSelectedClassId(classId);
      setSelectedCurriculumId(null);
      setSelectedChapterId(null);
      setSelectedTopicsMap(new Map());
    },
    [selectedClassId],
  );

  const handleSelectCurriculum = useCallback(
    (curriculumId: string) => {
      if (curriculumId === selectedCurriculumId) return;
      setSelectedCurriculumId(curriculumId);
      setSelectedChapterId(null);
      setSelectedTopicsMap(new Map());
    },
    [selectedCurriculumId],
  );

  const handleSelectChapter = useCallback(
    (chapterId: string) => {
      if (chapterId === selectedChapterId) return;
      setSelectedChapterId(chapterId);
    },
    [selectedChapterId],
  );

  const handleToggleTopic = useCallback(
    (topic: TopicRow) => {
      if (!selectedChapter) return;
      const chLabel = `Ch ${selectedChapter.chapterNo}. ${selectedChapter.chapterName}`;
      setSelectedTopicsMap(prev => {
        const next = new Map(prev);
        if (next.has(topic.id)) {
          next.delete(topic.id);
        } else {
          next.set(topic.id, {
            id: topic.id,
            name: topic.topicName,
            chapterId: selectedChapter.id,
            chapterName: chLabel,
          });
        }
        return next;
      });
    },
    [selectedChapter],
  );

  const handleRemoveTopic = useCallback((topicId: string) => {
    setSelectedTopicsMap(prev => {
      const next = new Map(prev);
      next.delete(topicId);
      return next;
    });
  }, []);

  const allInChapterSelected = useMemo(() => {
    if (topics.length === 0) return false;
    return topics.every(t => selectedTopicsMap.has(t.id));
  }, [topics, selectedTopicsMap]);

  const handleSelectAllTopics = useCallback(() => {
    if (!selectedChapter) return;
    const chLabel = `Ch ${selectedChapter.chapterNo}. ${selectedChapter.chapterName}`;
    setSelectedTopicsMap(prev => {
      const next = new Map(prev);
      if (allInChapterSelected) {
        for (const t of topics) {
          next.delete(t.id);
        }
      } else {
        for (const t of topics) {
          next.set(t.id, {
            id: t.id,
            name: t.topicName,
            chapterId: selectedChapter.id,
            chapterName: chLabel,
          });
        }
      }
      return next;
    });
  }, [allInChapterSelected, selectedChapter, topics]);

  function getCalculatedDueEpochMs(offsetDays: number): number {
    const base = defaultDueAtEpochMs();
    return base + offsetDays * 24 * 60 * 60 * 1000;
  }

  async function onAssign() {
    if (
      !schoolState.data ||
      !selectedClass ||
      !selectedCurriculum ||
      selectedTopicsList.length === 0
    ) {
      Alert.alert(
        'Incomplete selection',
        'Please select class, subject, and at least one topic.',
      );
      return;
    }

    setSubmitting(true);
    const dueAt = getCalculatedDueEpochMs(DUE_OPTIONS[dueIdx].daysOffset);

    try {
      const results: AssignTopicResult[] = [];
      const errors: string[] = [];

      for (const item of selectedTopicsList) {
        const topicName = item.name || item.id;
        const chapterId = item.chapterId || selectedChapterId;
        if (!chapterId) {
          errors.push(`${topicName}: Missing chapter info.`);
          continue;
        }

        try {
          const res = await callFn<AssignTopicPayload, AssignTopicResult>(
            'assignTopic',
            {
              schoolId: schoolState.data.schoolId,
              classId: selectedClass.id,
              curriculumId: selectedCurriculum.id,
              chapterId,
              topicId: item.id,
              dueAt,
            },
          );
          results.push(res);
        } catch (err: any) {
          errors.push(`${topicName}: ${humanise(err)}`);
        }
      }

      if (results.length > 0) {
        const summary = `${results.length} ${
          results.length > 1 ? 'topics' : 'topic'
        } · ${QUESTION_COUNTS[qCountIdx]} questions each · due ${DUE_OPTIONS[
          dueIdx
        ].label.toLowerCase()} 11:59 PM.`;

        navigation.navigate('TeacherDone', {
          kind: 'assign',
          classId: selectedClass.id,
          className: selectedClass.className,
          summary,
        });
      } else {
        Alert.alert('Assignment Failed', errors.join('\n'));
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not complete assignment.');
    } finally {
      setSubmitting(false);
    }
  }

  const classNameLabel = selectedClass
    ? `Class ${selectedClass.className}`
    : 'Select Class';
  const subjectLabel = selectedCurriculum
    ? selectedCurriculum.subject.charAt(0).toUpperCase() +
      selectedCurriculum.subject.slice(1)
    : 'Select Subject';
  const chapterLabel = selectedChapter
    ? `Ch ${selectedChapter.chapterNo}. ${selectedChapter.chapterName}`
    : 'Select Chapter';

  return (
    <CosmicBackground>
      <CosmicHeader
        title="Assign a topic"
        subtitle={classNameLabel}
        onBack={() => navigation.goBack()}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}>
        {/* Current Target Banner */}
        <View style={styles.targetBanner}>
          <Text style={styles.targetPre}>ASSIGNING TO</Text>
          <Text style={styles.targetTitle}>
            {classNameLabel} · {subjectLabel}
          </Text>
          <Text style={styles.targetSub}>{chapterLabel}</Text>
        </View>

        {/* 1. Class Picker Section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>1. SELECT CLASS</Text>
          {classesState.loading && classes.length === 0 ? (
            <ActivityIndicator color={cosmicColors.purple} style={styles.loader} />
          ) : classesState.error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{classesState.error}</Text>
            </View>
          ) : classes.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>
                No classes assigned to you yet. Ask your principal to add you to
                a class.
              </Text>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalRow}>
              {classes.map(c => {
                const isSelected = selectedClassId === c.id;
                return (
                  <Pressable
                    key={c.id}
                    style={[
                      styles.classCard,
                      isSelected && styles.classCardActive,
                    ]}
                    onPress={() => handleSelectClass(c.id)}>
                    <Text
                      style={[
                        styles.classCardTitle,
                        isSelected && styles.classCardTitleActive,
                      ]}>
                      Class {c.className}
                    </Text>
                    <Text style={styles.classCardSub}>
                      Grade {c.grade} • Sec {c.section}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>

        {/* 2. Subject Picker Section */}
        {selectedClassId ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>2. SELECT SUBJECT</Text>
            {allCurriculaState.loading && curricula.length === 0 ? (
              <ActivityIndicator color={cosmicColors.purple} style={styles.loader} />
            ) : allCurriculaState.error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{allCurriculaState.error}</Text>
              </View>
            ) : curricula.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>
                  No curriculum available for this grade yet.
                </Text>
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalRow}>
                {curricula.map(s => {
                  const isSelected = selectedCurriculumId === s.id;
                  const subjectName =
                    s.subject.charAt(0).toUpperCase() + s.subject.slice(1);
                  return (
                    <Pressable
                      key={s.id}
                      style={[
                        styles.subjectCard,
                        isSelected && styles.subjectCardActive,
                      ]}
                      onPress={() => handleSelectCurriculum(s.id)}>
                      <Text
                        style={[
                          styles.subjectCardTitle,
                          isSelected && styles.subjectCardTitleActive,
                        ]}>
                        {subjectName}
                      </Text>
                      <Text style={styles.subjectCardSub}>
                        {s.board.toUpperCase()}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </View>
        ) : null}

        {/* 3. Chapter Picker Section */}
        {selectedCurriculumId ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>3. SELECT CHAPTER</Text>
            {chaptersState.loading && chapters.length === 0 ? (
              <ActivityIndicator color={cosmicColors.purple} style={styles.loader} />
            ) : chaptersState.error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{chaptersState.error}</Text>
              </View>
            ) : chapters.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>
                  No published chapters yet. Ask an admin to import content.
                </Text>
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalRow}>
                {chapters.map(ch => {
                  const isSelected = selectedChapterId === ch.id;
                  const selectedInCh = selectedTopicsList.filter(
                    t => t.chapterId === ch.id,
                  ).length;

                  return (
                    <Pressable
                      key={ch.id}
                      style={[
                        styles.chapterCard,
                        isSelected && styles.chapterCardActive,
                      ]}
                      onPress={() => handleSelectChapter(ch.id)}>
                      <View style={styles.chapterCardHeaderRow}>
                        <Text
                          style={[
                            styles.chapterNo,
                            isSelected && styles.chapterNoActive,
                          ]}>
                          CH {ch.chapterNo}
                        </Text>
                        {selectedInCh > 0 ? (
                          <View style={styles.chapterBadge}>
                            <Text style={styles.chapterBadgeText}>
                              {selectedInCh}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      <Text
                        style={[
                          styles.chapterName,
                          isSelected && styles.chapterNameActive,
                        ]}
                        numberOfLines={2}>
                        {ch.chapterName}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </View>
        ) : null}

        {/* 4. Topic Picker Section */}
        {selectedChapterId ? (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionLabel}>
                4. SELECT TOPICS ({selectedTopicsList.length} SELECTED)
              </Text>
              {topics.length > 0 ? (
                <Pressable hitSlop={8} onPress={handleSelectAllTopics}>
                  <Text style={styles.selectAllText}>
                    {allInChapterSelected
                      ? 'Deselect Chapter'
                      : 'Select Chapter'}
                  </Text>
                </Pressable>
              ) : null}
            </View>

            {selectedTopicsList.length > 0 ? (
              <View style={styles.selectedChipsWrap}>
                {selectedTopicsList.map(item => (
                  <View key={item.id} style={styles.selectedChip}>
                    <Text style={styles.selectedChipText} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Pressable
                      hitSlop={8}
                      onPress={() => handleRemoveTopic(item.id)}>
                      <Text style={styles.selectedChipRemove}>✕</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}

            {topicsState.loading && topics.length === 0 ? (
              <ActivityIndicator color={cosmicColors.purple} style={styles.loader} />
            ) : topicsState.error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{topicsState.error}</Text>
              </View>
            ) : topics.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>
                  No published topics in this chapter yet.
                </Text>
              </View>
            ) : (
              <View style={styles.topicsList}>
                {topics.map(t => {
                  const isSelected = selectedTopicsMap.has(t.id);
                  return (
                    <Pressable
                      key={t.id}
                      style={[
                        styles.topicRow,
                        isSelected && styles.topicRowActive,
                      ]}
                      onPress={() => handleToggleTopic(t)}>
                      <View
                        style={[
                          styles.checkbox,
                          isSelected && styles.checkboxChecked,
                        ]}>
                        {isSelected ? (
                          <Text style={styles.checkmark}>✓</Text>
                        ) : null}
                      </View>
                      <Text
                        style={[
                          styles.topicName,
                          isSelected && styles.topicNameActive,
                        ]}
                        numberOfLines={2}>
                        {t.topicName}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        ) : null}

        {/* 5. Questions Per Topic */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>QUESTIONS PER TOPIC</Text>
          <View style={styles.pillRow}>
            {QUESTION_COUNTS.map((cnt, idx) => {
              const active = qCountIdx === idx;
              return (
                <Pressable
                  key={cnt}
                  style={[styles.pill, active && styles.pillActive]}
                  onPress={() => setQCountIdx(idx)}>
                  <Text
                    style={[styles.pillText, active && styles.pillTextActive]}>
                    {cnt}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* 6. Due Date Options */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>DUE</Text>
          <View style={styles.pillRow}>
            {DUE_OPTIONS.map((d, idx) => {
              const active = dueIdx === idx;
              return (
                <Pressable
                  key={d.label}
                  style={[styles.duePill, active && styles.pillActive]}
                  onPress={() => setDueIdx(idx)}>
                  <Text
                    style={[
                      styles.duePillTitle,
                      active && styles.pillTextActive,
                    ]}>
                    {d.label}
                  </Text>
                  <Text style={styles.duePillSub}>{d.sub}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* 7. Submit Button */}
        <Pressable
          disabled={submitting || selectedTopicsList.length === 0}
          style={[
            styles.submitBtn,
            (submitting || selectedTopicsList.length === 0) &&
              styles.submitBtnDisabled,
          ]}
          onPress={onAssign}>
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitBtnText}>
              {selectedTopicsList.length > 0
                ? `Assign ${selectedTopicsList.length} ${
                    selectedTopicsList.length > 1 ? 'topics' : 'topic'
                  } to ${classNameLabel}`
                : 'Select topics to assign'}
            </Text>
          )}
        </Pressable>

        <View style={{height: 40}} />
      </ScrollView>
    </CosmicBackground>
  );
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
  targetBanner: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: cosmicColors.purpleBgLight,
    borderWidth: 1,
    borderColor: cosmicColors.purpleBorder,
  },
  targetPre: {
    color: cosmicColors.purpleLight,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  targetTitle: {
    color: cosmicColors.text,
    fontSize: 19,
    fontWeight: '700',
    marginTop: 6,
  },
  targetSub: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12.5,
    marginTop: 3,
  },
  section: {
    gap: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 2,
  },
  sectionLabel: {
    color: cosmicColors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    marginHorizontal: 2,
  },
  selectAllText: {
    color: cosmicColors.purpleSoft,
    fontSize: 12,
    fontWeight: '700',
  },
  horizontalRow: {
    gap: 10,
    paddingVertical: 2,
  },
  classCard: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    minWidth: 120,
  },
  classCardActive: {
    backgroundColor: cosmicColors.purpleBg,
    borderColor: cosmicColors.purpleBorder,
  },
  classCardTitle: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    fontWeight: '700',
  },
  classCardTitleActive: {
    color: '#FFFFFF',
  },
  classCardSub: {
    color: cosmicColors.textSubtle,
    fontSize: 11,
    marginTop: 3,
  },
  subjectCard: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    minWidth: 110,
  },
  subjectCardActive: {
    backgroundColor: cosmicColors.purpleBg,
    borderColor: cosmicColors.purpleBorder,
  },
  subjectCardTitle: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    fontWeight: '700',
  },
  subjectCardTitleActive: {
    color: '#FFFFFF',
  },
  subjectCardSub: {
    color: cosmicColors.textSubtle,
    fontSize: 10,
    marginTop: 3,
    fontWeight: '600',
  },
  chapterCard: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    maxWidth: 200,
  },
  chapterCardActive: {
    backgroundColor: cosmicColors.purpleBg,
    borderColor: cosmicColors.purpleBorder,
  },
  chapterCardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  chapterBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: cosmicColors.purple,
  },
  chapterBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  chapterNo: {
    color: cosmicColors.cyanLight,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  chapterNoActive: {
    color: cosmicColors.cyan,
  },
  chapterName: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  chapterNameActive: {
    color: '#FFFFFF',
  },
  selectedChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: 4,
  },
  selectedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: cosmicColors.purpleBg,
    borderWidth: 1,
    borderColor: cosmicColors.purpleBorder,
  },
  selectedChipText: {
    color: cosmicColors.purpleSoft,
    fontSize: 12,
    fontWeight: '600',
    maxWidth: 180,
  },
  selectedChipRemove: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 13,
    fontWeight: '700',
    paddingLeft: 2,
  },
  topicsList: {
    gap: 9,
  },
  topicRow: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: cosmicColors.purpleBgLight,
    borderWidth: 1,
    borderColor: cosmicColors.purpleBorder,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  topicRowActive: {
    backgroundColor: 'rgba(139, 92, 246, 0.25)',
    borderColor: cosmicColors.purple,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: cosmicColors.purple,
    borderColor: cosmicColors.purple,
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    marginTop: -1,
  },
  topicName: {
    flex: 1,
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 13.5,
    fontWeight: '600',
  },
  topicNameActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  pillRow: {
    flexDirection: 'row',
    gap: 9,
  },
  pill: {
    flex: 1,
    paddingVertical: 13,
    paddingHorizontal: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillActive: {
    backgroundColor: cosmicColors.purpleBg,
    borderColor: cosmicColors.purpleBorder,
  },
  pillText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 15,
    fontWeight: '700',
  },
  pillTextActive: {
    color: '#FFFFFF',
  },
  duePill: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  duePillTitle: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 13,
    fontWeight: '700',
  },
  duePillSub: {
    color: cosmicColors.textSubtle,
    fontSize: 10,
    marginTop: 3,
  },
  submitBtn: {
    height: 58,
    borderRadius: 18,
    backgroundColor: cosmicColors.purple,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    shadowColor: cosmicColors.purple,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 4,
  },
  submitBtnDisabled: {
    opacity: 0.45,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  loader: {
    marginVertical: 16,
  },
  emptyCard: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: cosmicColors.cardBg,
    alignItems: 'center',
  },
  emptyText: {
    color: cosmicColors.textMuted,
    fontSize: 13,
    textAlign: 'center',
  },
  errorBox: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(236, 72, 153, 0.12)',
    borderWidth: 1,
    borderColor: cosmicColors.pinkBorder,
  },
  errorText: {
    color: cosmicColors.pinkLight,
    fontSize: 12,
  },
});
