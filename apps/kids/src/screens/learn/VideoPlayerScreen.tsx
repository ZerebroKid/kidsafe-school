import React, {useCallback, useMemo, useState} from 'react';
import {Dimensions, StyleSheet, Text, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import YoutubePlayer from 'react-native-youtube-iframe';

import {colors, spacing} from '../../theme';
import type {StudyStackParamList} from '../../navigation/types';

type Props = NativeStackScreenProps<StudyStackParamList, 'VideoPlayer'>;

const SCREEN_WIDTH = Dimensions.get('window').width;
const PLAYER_HEIGHT = Math.round(SCREEN_WIDTH * (9 / 16));

// Navigations we never allow -- these would take the child out of the app
// (into the YouTube site or app). Everything else (the player host page,
// the embed, googlevideo, ytimg, the iframe API) is allowed so the player
// works normally.
const BLOCK_PATTERN =
  /youtube\.com\/watch|youtu\.be\/|m\.youtube\.com|youtube\.com\/(channel|@|user)|^intent:|^vnd\.youtube|^market:|play\.google\.com/i;

export function VideoPlayerScreen({route}: Props) {
  const {videoUrl} = route.params;
  const videoId = useMemo(() => extractYouTubeId(videoUrl), [videoUrl]);
  const [error, setError] = useState(false);

  const onReady = useCallback(() => {
    console.log('[VideoPlayer] ready');
  }, []);

  const onChangeState = useCallback((state: string) => {
    console.log('[VideoPlayer] state:', state);
  }, []);

  const onError = useCallback((e: string) => {
    console.log('[VideoPlayer] onError:', e);
    setError(true);
  }, []);

  if (!videoId) {
    console.log('[VideoPlayer] invalid url:', videoUrl);
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Invalid video URL</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Could not load the video</Text>
      </View>
    );
  }

  console.log('[VideoPlayer] rendering videoId:', videoId);

  return (
    <View style={styles.container}>
      <YoutubePlayer
        height={PLAYER_HEIGHT}
        videoId={videoId}
        play={true}
        onReady={onReady}
        onError={onError}
        onChangeState={onChangeState}
        initialPlayerParams={{
          controls: true,
          rel: false,
          modestbranding: true,
        }}
        webViewProps={{
          androidLayerType: 'hardware',
          setSupportMultipleWindows: false,
          onLoadEnd: () => console.log('[VideoPlayer] webview loadEnd'),
          onShouldStartLoadWithRequest: (request: {url: string}) => {
            const url = request?.url ?? '';
            console.log('[VideoPlayer] shouldStart:', url);
            if (BLOCK_PATTERN.test(url)) {
              console.log('[VideoPlayer] BLOCKED redirect:', url);
              return false;
            }
            return true;
          },
        }}
        webViewStyle={styles.webview}
      />
      <View style={styles.infoSection}>
        <Text style={styles.hint}>Tap the play button to start the video</Text>
      </View>
    </View>
  );
}

function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const watchMatch = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (watchMatch) return watchMatch[1];
  const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (shortMatch) return shortMatch[1];
  const embedMatch = url.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
  if (embedMatch) return embedMatch[1];
  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: 'center',
  },
  centered: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  webview: {
    opacity: 0.99,
  },
  infoSection: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    alignItems: 'center',
  },
  hint: {
    fontSize: 13,
    color: colors.textMuted,
  },
  errorText: {
    fontSize: 14,
    color: colors.textMuted,
  },
});
