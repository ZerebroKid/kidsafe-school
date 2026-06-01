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
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

import type {BrainstormingItem} from '../../../firebase/study';
import type {StudyStackParamList} from '../../../navigation/types';
import {colors, radius, spacing} from '../../../theme';

type Nav = NativeStackNavigationProp<StudyStackParamList>;

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface Props {
  items: BrainstormingItem[];
}

export function BrainstormingSection({items}: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Think About It</Text>
      {items.map((item, i) => (
        <AccordionCard key={i} item={item} index={i} />
      ))}
    </View>
  );
}

function AccordionCard({item, index}: {item: BrainstormingItem; index: number}) {
  const navigation = useNavigation<Nav>();
  const [expanded, setExpanded] = useState(false);

  const toggle = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(prev => !prev);
  }, []);

  const openVideo = useCallback(() => {
    if (item.videoUrl) {
      navigation.navigate('VideoPlayer', {
        videoUrl: item.videoUrl,
        title: item.question,
      });
    }
  }, [navigation, item.videoUrl, item.question]);

  return (
    <Pressable
      onPress={toggle}
      style={styles.card}
      android_ripple={{color: 'rgba(0,0,0,0.04)'}}>
      <View style={styles.questionRow}>
        <Text style={styles.questionNumber}>Q{index + 1}</Text>
        <Text style={styles.questionText}>{item.question}</Text>
        <Text style={styles.chevron}>{expanded ? '▲' : '▼'}</Text>
      </View>
      {expanded ? (
        <View style={styles.answerContainer}>
          <Text style={styles.answerText}>{item.answer}</Text>
          {item.videoUrl ? (
            <Pressable onPress={openVideo} style={styles.videoLink}>
              <Text style={styles.videoLinkText}>▶ Watch video</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {gap: spacing.sm},
  heading: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  card: {
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  questionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  questionNumber: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    marginTop: 2,
  },
  questionText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    lineHeight: 20,
  },
  chevron: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 4,
  },
  answerContainer: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  answerText: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 20,
  },
  videoLink: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
  },
  videoLinkText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
});
