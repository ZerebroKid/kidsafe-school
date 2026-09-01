import React, {useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {
  useChaptersForCurriculum,
  useCurriculaForGrade,
  usePublishedTopics,
  type ChapterRow,
  type TopicRow,
} from '../../firebase/teacher';
import type {TeacherStackParamList} from '../../navigation/types';
import {cosmicColors, cosmicRadius, cosmicSpacing} from './theme';
import {CosmicBackground} from './components/CosmicBackground';
import {CosmicHeader} from './components/CosmicHeader';

type Props = NativeStackScreenProps<TeacherStackParamList, 'TeacherClassDetail'>;

interface SelectedTopic {
  id: string;
  name: string;
  chapterId: string;
  chapterName: string;
}

export function ClassDetailScreen({route, navigation}: Props) {
  const {classId, className, grade = 8, section = 'A', board = 'CBSE'} = route.params;

  // Curricula for this grade
  const curriculaState = useCurriculaForGrade(grade);
  const primaryCurriculum = curriculaState.data?.[0] ?? null;

  // Chapters for primary curriculum
  const chaptersState = useChaptersForCurriculum(primaryCurriculum?.id ?? null);
  const chapters = chaptersState.data ?? [];

  const [openChapterId, setOpenChapterId] = useState<string | null>(null);
  const [selectedTopics, setSelectedTopics] = useState<Map<string, SelectedTopic>>(
    new Map(),
  );

  // Set default open chapter when chapters load
  React.useEffect(() => {
    if (chapters.length > 0 && openChapterId === null) {
      setOpenChapterId(chapters[0].id);
    }
  }, [chapters, openChapterId]);

  function toggleTopic(topic: SelectedTopic) {
    setSelectedTopics(prev => {
      const next = new Map(prev);
      if (next.has(topic.id)) {
        next.delete(topic.id);
      } else {
        next.set(topic.id, topic);
      }
      return next;
    });
  }

  const selectedList = useMemo(
    () => Array.from(selectedTopics.values()),
    [selectedTopics],
  );

  const hasSelections = selectedList.length > 0;
  const currentChapter = chapters.find(c => c.id === openChapterId);

  return (
    <CosmicBackground>
      <CosmicHeader
        title={`Class ${className}`}
        subtitle={`${board} · Grade ${grade} · Section ${section}`}
        onBack={() => navigation.goBack()}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}>
        {/* Top 3 Metric Stat Cards */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, {color: cosmicColors.purpleSoft}]}>
              68%
            </Text>
            <Text style={styles.statLabel}>Mastery</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, {color: cosmicColors.cyanLight}]}>
              30
            </Text>
            <Text style={styles.statLabel}>Students</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, {color: cosmicColors.pinkLight}]}>
              6
            </Text>
            <Text style={styles.statLabel}>Need help</Text>
          </View>
        </View>

        {/* Action Buttons Row */}
        <View style={styles.actionButtonsRow}>
          <Pressable
            style={styles.reportBtn}
            onPress={() =>
              navigation.navigate('TeacherClassReport', {classId, className})
            }>
            <Text style={styles.reportBtnText}>Class report</Text>
          </Pressable>
          <Pressable
            style={styles.quizBtn}
            onPress={() =>
              navigation.navigate('TeacherLiveQuiz', {
                classId,
                className,
                chapterName: currentChapter ? `Ch ${currentChapter.chapterNo}. ${currentChapter.chapterName}` : 'Chapter 1',
                roomCode: `${className.replace(/[^a-zA-Z0-9]/g, '')}2X`,
              })
            }>
            <Text style={styles.quizBtnText}>Live quiz</Text>
          </Pressable>
        </View>

        {/* Syllabus Header */}
        <Text style={styles.syllabusHeader}>
          SYLLABUS · {board} · GRADE {grade}
        </Text>

        {chaptersState.loading && chapters.length === 0 ? (
          <ActivityIndicator
            color={cosmicColors.purple}
            style={{marginTop: cosmicSpacing.lg}}
          />
        ) : chapters.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No chapters published yet</Text>
          </View>
        ) : (
          <View style={styles.chapterList}>
            {chapters.map(ch => {
              const isOpen = openChapterId === ch.id;
              const chTitle = `Ch ${ch.chapterNo}. ${ch.chapterName}`;

              return (
                <ChapterAccordion
                  key={ch.id}
                  chapter={ch}
                  curriculumId={primaryCurriculum?.id ?? ''}
                  isOpen={isOpen}
                  onToggle={() =>
                    setOpenChapterId(prev => (prev === ch.id ? null : ch.id))
                  }
                  selectedTopics={selectedTopics}
                  onToggleTopic={toggleTopic}
                />
              );
            })}
          </View>
        )}

        <View style={{height: 100}} />
      </ScrollView>

      {/* Sticky Bottom CTA */}
      <View style={styles.bottomBar}>
        <Pressable
          disabled={!hasSelections}
          style={[
            styles.ctaBtn,
            hasSelections ? styles.ctaBtnActive : styles.ctaBtnDisabled,
          ]}
          onPress={() =>
            navigation.navigate('TeacherAssign', {
              classId,
              className,
              curriculumId: primaryCurriculum?.id,
              chapterId: currentChapter?.id,
              chapterName: currentChapter ? `Ch ${currentChapter.chapterNo}. ${currentChapter.chapterName}` : undefined,
              initialTopics: selectedList.map(t => ({
                id: t.id,
                name: t.name,
                chapterId: t.chapterId,
                chapterName: t.chapterName,
              })),
            })
          }>
          <Text
            style={[
              styles.ctaBtnText,
              hasSelections ? styles.ctaTextActive : styles.ctaTextDisabled,
            ]}>
            {hasSelections
              ? `Assign ${selectedList.length} ${
                  selectedList.length > 1 ? 'topics' : 'topic'
                } to ${className}`
              : 'Select topics to assign'}
          </Text>
        </Pressable>
      </View>
    </CosmicBackground>
  );
}

function ChapterAccordion({
  chapter,
  curriculumId,
  isOpen,
  onToggle,
  selectedTopics,
  onToggleTopic,
}: {
  chapter: ChapterRow;
  curriculumId: string;
  isOpen: boolean;
  onToggle: () => void;
  selectedTopics: Map<string, SelectedTopic>;
  onToggleTopic: (topic: SelectedTopic) => void;
}) {
  const topicsState = usePublishedTopics(
    isOpen ? curriculumId : null,
    isOpen ? chapter.id : null,
  );
  const topics = topicsState.data ?? [];

  const selectedCountInChapter = topics.filter(t =>
    selectedTopics.has(t.id),
  ).length;

  const chLabel = `Ch ${chapter.chapterNo}. ${chapter.chapterName}`;

  return (
    <View
      style={[
        styles.chapterCard,
        selectedCountInChapter > 0 && styles.chapterCardHighlighted,
      ]}>
      {/* Chapter header */}
      <Pressable style={styles.chapterHeader} onPress={onToggle}>
        <View style={styles.chapterTitleWrap}>
          <Text style={styles.chapterTitle}>{chLabel}</Text>
          <Text style={styles.chapterMeta}>
            {topics.length > 0 ? `${topics.length} topics` : 'View topics'}
            {selectedCountInChapter > 0
              ? ` · ${selectedCountInChapter} selected`
              : ''}
          </Text>
        </View>
        <Text style={styles.chapterCaret}>{isOpen ? '▲' : '▼'}</Text>
      </Pressable>

      {/* Topics list when open */}
      {isOpen ? (
        <View style={styles.topicsList}>
          {topicsState.loading && topics.length === 0 ? (
            <ActivityIndicator
              color={cosmicColors.purple}
              size="small"
              style={{paddingVertical: 10}}
            />
          ) : topics.length === 0 ? (
            <Text style={styles.noTopicsText}>No topics published</Text>
          ) : (
            topics.map((t, idx) => {
              const isSelected = selectedTopics.has(t.id);
              // Sample weak indicator
              const isWeak = idx === 1 || idx === 2;

              return (
                <Pressable
                  key={t.id}
                  style={[
                    styles.topicCard,
                    isSelected && styles.topicCardSelected,
                  ]}
                  onPress={() =>
                    onToggleTopic({
                      id: t.id,
                      name: t.topicName,
                      chapterId: chapter.id,
                      chapterName: chLabel,
                    })
                  }>
                  <View
                    style={[
                      styles.checkbox,
                      isSelected && styles.checkboxSelected,
                    ]}>
                    {isSelected ? <Text style={styles.checkIcon}>✓</Text> : null}
                  </View>
                  <Text
                    style={[
                      styles.topicName,
                      isSelected && styles.topicNameSelected,
                    ]}
                    numberOfLines={2}>
                    {t.topicName}
                  </Text>
                  <Text
                    style={[
                      styles.topicHint,
                      isWeak ? styles.topicHintWeak : null,
                    ]}>
                    {isWeak ? '38% avg' : '72% avg'}
                  </Text>
                </Pressable>
              );
            })
          )}
        </View>
      ) : null}
    </View>
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
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 16,
    backgroundColor: cosmicColors.cardBg,
    borderWidth: 1,
    borderColor: cosmicColors.cardBorder,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  statLabel: {
    color: cosmicColors.textMuted,
    fontSize: 11,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  reportBtn: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    backgroundColor: cosmicColors.cardBg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportBtnText: {
    color: cosmicColors.purpleSoft,
    fontSize: 13,
    fontWeight: '700',
  },
  quizBtn: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    backgroundColor: cosmicColors.cyanBg,
    borderWidth: 1,
    borderColor: cosmicColors.cyanBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quizBtnText: {
    color: cosmicColors.cyanLight,
    fontSize: 13,
    fontWeight: '700',
  },
  syllabusHeader: {
    color: cosmicColors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    marginHorizontal: 2,
    marginTop: 4,
  },
  chapterList: {
    gap: 10,
  },
  chapterCard: {
    borderRadius: 18,
    backgroundColor: cosmicColors.cardBgSubtle,
    borderWidth: 1,
    borderColor: cosmicColors.cardBorderSubtle,
    overflow: 'hidden',
  },
  chapterCardHighlighted: {
    borderColor: cosmicColors.purpleBorder,
  },
  chapterHeader: {
    paddingHorizontal: 16,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  chapterTitleWrap: {
    flex: 1,
  },
  chapterTitle: {
    color: cosmicColors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  chapterMeta: {
    color: cosmicColors.textMuted,
    fontSize: 11.5,
    marginTop: 3,
  },
  chapterCaret: {
    color: cosmicColors.purpleLight,
    fontSize: 12,
  },
  topicsList: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 8,
  },
  topicCard: {
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  topicCardSelected: {
    backgroundColor: cosmicColors.purpleBg,
    borderColor: cosmicColors.purpleBorder,
  },
  checkbox: {
    width: 21,
    height: 21,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: cosmicColors.purple,
    borderColor: cosmicColors.purple,
  },
  checkIcon: {
    color: '#0B0620',
    fontSize: 12,
    fontWeight: '900',
  },
  topicName: {
    flex: 1,
    color: 'rgba(255, 255, 255, 0.72)',
    fontSize: 13.5,
    fontWeight: '600',
  },
  topicNameSelected: {
    color: cosmicColors.text,
  },
  topicHint: {
    color: cosmicColors.textSubtle,
    fontSize: 11,
  },
  topicHintWeak: {
    color: cosmicColors.pinkLight,
    fontWeight: '600',
  },
  noTopicsText: {
    color: cosmicColors.textMuted,
    fontSize: 12,
    paddingVertical: 8,
    textAlign: 'center',
  },
  emptyCard: {
    padding: 24,
    borderRadius: 16,
    backgroundColor: cosmicColors.cardBg,
    alignItems: 'center',
  },
  emptyText: {
    color: cosmicColors.textMuted,
    fontSize: 13,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: cosmicSpacing.lg,
    paddingVertical: cosmicSpacing.md,
    backgroundColor: 'rgba(11, 6, 32, 0.95)',
    borderTopWidth: 1,
    borderTopColor: cosmicColors.cardBorder,
  },
  ctaBtn: {
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaBtnActive: {
    backgroundColor: cosmicColors.purple,
    shadowColor: cosmicColors.purple,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 4,
  },
  ctaBtnDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  ctaBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
  ctaTextActive: {
    color: '#FFFFFF',
  },
  ctaTextDisabled: {
    color: 'rgba(255, 255, 255, 0.45)',
  },
});
