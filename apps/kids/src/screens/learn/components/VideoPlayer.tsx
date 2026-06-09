import React, {useCallback, useMemo} from 'react';
import {Image, Pressable, StyleSheet, Text, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {colors, radius, spacing} from '../../../theme';
import {extractYouTubeId} from '../../../lib/youtube';
import type {StudyStackParamList} from '../../../navigation/types';

type Nav = NativeStackNavigationProp<StudyStackParamList>;

interface Props {
  url: string;
  title?: string;
}

/**
 * Inline YouTube thumbnail preview. Tapping navigates to the dedicated
 * VideoPlayerScreen which plays the video inside the app using
 * react-native-youtube-iframe (no YouTube app redirect).
 */
export function VideoPlayer({url, title}: Props) {
  const navigation = useNavigation<Nav>();
  const videoId = useMemo(() => extractYouTubeId(url), [url]);

  const openPlayer = useCallback(() => {
    navigation.navigate('VideoPlayer', {videoUrl: url, title});
  }, [navigation, url, title]);

  if (!videoId) {
    return (
      <View style={[styles.container, styles.errorContainer]}>
        <Text style={styles.errorText}>Video unavailable</Text>
      </View>
    );
  }

  const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

  return (
    <Pressable
      onPress={openPlayer}
      android_ripple={{color: 'rgba(0,0,0,0.08)'}}
      style={styles.container}>
      <Image
        source={{uri: thumbnailUrl}}
        style={styles.thumbnail}
        resizeMode="cover"
      />
      <View style={styles.overlay}>
        <View style={styles.playButton}>
          <Text style={styles.playIcon}>▶</Text>
        </View>
        <Text style={styles.tapLabel}>Tap to watch</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
  },
  thumbnail: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,0,0,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playIcon: {
    fontSize: 22,
    color: '#FFFFFF',
    marginLeft: 3,
  },
  tapLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 2,
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 13,
    color: colors.textMuted,
  },
});
