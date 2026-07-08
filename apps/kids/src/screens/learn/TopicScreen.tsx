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
import {
  useTopicContent,
  sectionsForCollapsibleList,
  sectionsFromLegacyFields,
} from '../../firebase/study';
import {colors, radius, spacing} from '../../theme';
import type {StudyStackParamList} from '../../navigation/types';
import {CollapsibleSectionList} from './components/CollapsibleSectionList';

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

  const sections = topic.sections?.length
    ? sectionsForCollapsibleList(topic.sections)
    : sectionsFromLegacyFields(topic);

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

        <CollapsibleSectionList sections={sections} />

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
