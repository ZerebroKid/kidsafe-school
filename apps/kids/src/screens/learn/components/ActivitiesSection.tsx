import React, {useCallback} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

import type {ActivityItem} from '../../../firebase/study';
import type {StudyStackParamList} from '../../../navigation/types';
import {colors, radius, spacing} from '../../../theme';

type Nav = NativeStackNavigationProp<StudyStackParamList>;

interface Props {
  items: ActivityItem[];
}

export function ActivitiesSection({items}: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Try This</Text>
      {items.map((item, i) => (
        <ActivityCard key={i} index={i} item={item} />
      ))}
    </View>
  );
}

function ActivityCard({index, item}: {index: number; item: ActivityItem}) {
  const navigation = useNavigation<Nav>();

  const openVideo = useCallback(() => {
    if (item.videoUrl) {
      navigation.navigate('VideoPlayer', {
        videoUrl: item.videoUrl,
        title: item.title,
      });
    }
  }, [navigation, item.videoUrl, item.title]);

  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <Text style={styles.number}>{index + 1}</Text>
        <Text style={styles.title}>{item.title}</Text>
      </View>
      <Text style={styles.instructions}>{item.instructions}</Text>
      {item.videoUrl ? (
        <Pressable onPress={openVideo} style={styles.videoLink}>
          <Text style={styles.videoLinkText}>▶ Watch video</Text>
        </Pressable>
      ) : null}
    </View>
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
    gap: spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  number: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    marginTop: 2,
  },
  title: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    lineHeight: 20,
  },
  instructions: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 20,
    paddingLeft: spacing.lg,
  },
  videoLink: {
    alignSelf: 'flex-start',
    marginLeft: spacing.lg,
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
