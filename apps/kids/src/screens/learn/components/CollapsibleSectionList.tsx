import React, {useCallback, useState} from 'react';
import {
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';

import type {TopicSection} from '../../../firebase/study';
import {contentIncludesYouTubeVideo} from '../../../lib/youtube';
import {colors, radius, spacing} from '../../../theme';
import {TopicMarkdownContent} from './TopicMarkdownContent';
import {VideoPlayer} from './VideoPlayer';

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface Props {
  sections: TopicSection[];
}

export function CollapsibleSectionList({sections}: Props) {
  return (
    <View style={styles.container}>
      {sections.map((section, i) => (
        <SectionCard key={`${section.heading}-${i}`} section={section} />
      ))}
    </View>
  );
}

function SectionCard({section}: {section: TopicSection}) {
  const [expanded, setExpanded] = useState(false);

  const toggle = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(prev => !prev);
  }, []);

  return (
    <View style={styles.card}>
      <Pressable
        onPress={toggle}
        style={styles.headerPressable}
        android_ripple={{color: 'rgba(0,0,0,0.04)'}}>
        <View style={styles.headerRow}>
          <Text style={styles.heading}>{section.heading}</Text>
          <Text style={styles.chevron}>{expanded ? '▲' : '▼'}</Text>
        </View>
      </Pressable>
      {expanded ? (
        <View style={styles.body}>
          <TopicMarkdownContent style={styles.content}>
            {section.content}
          </TopicMarkdownContent>
          {section.videoUrl &&
          !contentIncludesYouTubeVideo(section.content, section.videoUrl) ? (
            <View style={styles.videoWrap}>
              <VideoPlayer url={section.videoUrl} />
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {gap: spacing.sm},
  card: {
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  headerPressable: {
    borderRadius: radius.sm,
    marginHorizontal: -spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  heading: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    lineHeight: 20,
  },
  chevron: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 4,
  },
  body: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  content: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 22,
  },
  videoWrap: {marginTop: spacing.xs},
});
