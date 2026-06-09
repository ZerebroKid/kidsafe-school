import React from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {Button} from '../../components/Button';
import {useTopicContent, type TopicContent} from '../../firebase/study';
import {colors, radius, spacing} from '../../theme';
import type {StudyStackParamList} from '../../navigation/types';
import {BrainstormingSection} from './components/BrainstormingSection';
import {RealLifeSection} from './components/RealLifeSection';
import {MisconceptionsSection} from './components/MisconceptionsSection';
import {ActivitiesSection} from './components/ActivitiesSection';
import {WorkedProblemsSection} from './components/WorkedProblemsSection';
import {CollapsibleSectionList} from './components/CollapsibleSectionList';
import {VideoPlayer} from './components/VideoPlayer';

type Props = NativeStackScreenProps<StudyStackParamList, 'TopicLearn'>;

export function TopicScreen({route, navigation}: Props) {
  const {assignmentId, curriculumId, chapterId, topicId, topicName} =
    route.params;
  const {data: topic, loading, error} = useTopicContent(
    curriculumId,
    chapterId,
    topicId,
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading topic…</Text>
      </View>
    );
  }

  if (error || !topic) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorEmoji}>⚠️</Text>
        <Text style={styles.errorTitle}>Could not load topic</Text>
        <Text style={styles.errorBody}>{error ?? 'Topic not found.'}</Text>
        <Button
          title="Go back"
          variant="secondary"
          onPress={() => navigation.goBack()}
          style={{marginTop: spacing.md}}
        />
      </View>
    );
  }

  if (topic.status === 'draft') {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorEmoji}>🚧</Text>
        <Text style={styles.errorTitle}>Topic not ready yet</Text>
        <Text style={styles.errorBody}>
          This topic is still being prepared. Check back later.
        </Text>
        <Button
          title="Go back"
          variant="secondary"
          onPress={() => navigation.goBack()}
          style={{marginTop: spacing.md}}
        />
      </View>
    );
  }

  const useSections =
    topic.sections !== undefined && topic.sections.length > 0;

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.chapterBadge}>
            <Text style={styles.chapterBadgeText}>
              Ch {topic.chapterNo}. {topic.chapterName}
            </Text>
          </View>
          <Text style={styles.topicTitle}>{topic.topicName}</Text>
        </View>

        {useSections ? (
          <CollapsibleSectionList sections={topic.sections!} />
        ) : (
          <LegacyTopicBody topic={topic} />
        )}

        <View style={{height: 80}} />
      </ScrollView>

      <View style={styles.ctaContainer}>
        <Button
          title="Start Quiz"
          onPress={() =>
            navigation.navigate('Quiz', {
              assignmentId,
              curriculumId,
              chapterId,
              topicId,
              topicName,
            })
          }
        />
      </View>
    </View>
  );
}

function LegacyTopicBody({topic}: {topic: TopicContent}) {
  return (
    <>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Explanation</Text>
        <Text style={styles.explanationText}>{topic.explanation}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Examples</Text>
        {topic.examples.map((ex, i) => (
          <View key={i} style={styles.exampleRow}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.exampleText}>{ex}</Text>
          </View>
        ))}
      </View>

      {topic.videoUrl ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Watch & Learn</Text>
          <VideoPlayer url={topic.videoUrl} />
        </View>
      ) : null}

      {topic.realLifeConnections && topic.realLifeConnections.length > 0 ? (
        <View style={styles.section}>
          <RealLifeSection items={topic.realLifeConnections} />
        </View>
      ) : null}

      {topic.brainstorming.length > 0 ? (
        <View style={styles.section}>
          <BrainstormingSection items={topic.brainstorming} />
        </View>
      ) : null}

      {topic.misconceptions && topic.misconceptions.length > 0 ? (
        <View style={styles.section}>
          <MisconceptionsSection items={topic.misconceptions} />
        </View>
      ) : null}

      {topic.activities && topic.activities.length > 0 ? (
        <View style={styles.section}>
          <ActivitiesSection items={topic.activities} />
        </View>
      ) : null}

      {topic.workedProblems && topic.workedProblems.length > 0 ? (
        <View style={styles.section}>
          <WorkedProblemsSection items={topic.workedProblems} />
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: colors.bg},
  scroll: {flex: 1},
  content: {padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xl},
  centered: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  loadingText: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  header: {gap: spacing.sm},
  chapterBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  chapterBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  topicTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    lineHeight: 32,
  },
  section: {gap: spacing.sm},
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  explanationText: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 24,
  },
  exampleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingLeft: spacing.xs,
  },
  bullet: {
    fontSize: 16,
    color: colors.text,
    marginTop: 1,
  },
  exampleText: {
    flex: 1,
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 21,
  },
  ctaContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.md,
    paddingBottom: spacing.lg,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
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
