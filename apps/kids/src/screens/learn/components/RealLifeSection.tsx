import React, {useCallback} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

import type {RealLifeConnectionItem} from '../../../firebase/study';
import type {StudyStackParamList} from '../../../navigation/types';
import {colors, radius, spacing} from '../../../theme';

type Nav = NativeStackNavigationProp<StudyStackParamList>;

interface Props {
  items: RealLifeConnectionItem[];
}

export function RealLifeSection({items}: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Real Life Connections</Text>
      {items.map((item, i) => (
        <RealLifeCard key={i} item={item} />
      ))}
    </View>
  );
}

function RealLifeCard({item}: {item: RealLifeConnectionItem}) {
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
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.description}>{item.description}</Text>
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
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    lineHeight: 20,
  },
  description: {
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
