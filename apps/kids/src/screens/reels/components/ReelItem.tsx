import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';
import {runOnJS} from 'react-native-reanimated';
import Video, {
  type OnProgressData,
  type ReactVideoProps,
  type VideoRef,
} from 'react-native-video';

import type {ReelDoc} from '@zerebro/shared-types';
import {ReelOverlay} from './ReelOverlay';

// react-native-video ships types built against @types/react 19, while the
// mobile apps pin @types/react 18. The two `ReactNode` definitions differ
// (v19 adds `bigint`), so `Video`'s forwardRef type isn't recognised as a valid
// JSX component here. Re-type it against this app's React to bridge the gap;
// prop/ref typing is preserved via `ComponentProps`.
const VideoPlayer = Video as unknown as React.ComponentType<
  ReactVideoProps & React.RefAttributes<VideoRef>
>;

const {width: SCREEN_W, height: SCREEN_H} = Dimensions.get('window');

interface Props {
  reel: ReelDoc;
  isActive: boolean;
  screenFocused: boolean;
  // Mount the player ahead of time (paused) so it buffers before it becomes
  // active, removing the cold-start delay when the user swipes to it.
  preload?: boolean;
  onProgress?: (data: OnProgressData) => void;
}

export function ReelItem({
  reel,
  isActive,
  screenFocused,
  preload = false,
  onProgress,
}: Props) {
  const videoRef = useRef<VideoRef>(null);
  const [userPaused, setUserPaused] = useState(false);
  // `ready` flips true once the first frame is decoded (onReadyForDisplay).
  const [ready, setReady] = useState(false);

  // Reset the manual pause when the item scrolls off-screen so it auto-plays
  // the next time it becomes active.
  useEffect(() => {
    if (!isActive) setUserPaused(false);
  }, [isActive]);

  // Mount the player when it's active or queued for preload.
  const shouldRender = isActive || preload;
  const paused = !isActive || !screenFocused || userPaused;

  const handleProgress = useCallback(
    (data: OnProgressData) => {
      onProgress?.(data);
    },
    [onProgress],
  );

  const toggleUserPaused = useCallback(() => {
    setUserPaused(p => !p);
  }, []);

  // A gesture-handler Tap (not a plain Pressable): the carousel wraps every
  // item in its own pan gesture, which swallows the RN touch responder, so a
  // Pressable's onPress never fires. A Tap gesture cooperates with the
  // carousel's pan (tap fires on a quick touch; pan wins on a drag/swipe).
  const tap = useMemo(
    () =>
      Gesture.Tap()
        .maxDuration(250)
        .onEnd((_e, success) => {
          'worklet';
          if (!success) return;
          if (isActive && screenFocused) {
            runOnJS(toggleUserPaused)();
          }
        }),
    [isActive, screenFocused, toggleUserPaused],
  );

  return (
    <GestureDetector gesture={tap}>
      <View style={styles.container}>
        {reel.thumbnailUrl && !isActive && (
          <Image
            source={{uri: reel.thumbnailUrl}}
            style={styles.poster}
            resizeMode="cover"
          />
        )}

        {shouldRender && (
          <VideoPlayer
            ref={videoRef}
            source={{uri: reel.videoUrl}}
            style={styles.video}
            resizeMode="cover"
            repeat
            paused={paused}
            onProgress={handleProgress}
            progressUpdateInterval={250}
            posterResizeMode="cover"
            poster={reel.thumbnailUrl}
            minLoadRetryCount={5}
            onLoadStart={() => setReady(false)}
            onReadyForDisplay={() => setReady(true)}
            bufferConfig={{
              minBufferMs: 2000,
              maxBufferMs: 8000,
              bufferForPlaybackMs: 800,
              bufferForPlaybackAfterRebufferMs: 1500,
            }}
          />
        )}

        {isActive && screenFocused && !ready && !userPaused && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="rgba(255,255,255,0.5)" />
          </View>
        )}

        {isActive && screenFocused && userPaused && (
          <View style={styles.pauseOverlay} pointerEvents="none">
            <Text style={styles.playIcon}>{'\u25B6'}</Text>
          </View>
        )}

        <ReelOverlay title={reel.title} />
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    width: SCREEN_W,
    height: SCREEN_H,
    backgroundColor: '#000000',
  },
  video: {
    ...StyleSheet.absoluteFillObject,
  },
  poster: {
    ...StyleSheet.absoluteFillObject,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pauseOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIcon: {
    fontSize: 72,
    color: 'rgba(255,255,255,0.85)',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: {width: 0, height: 2},
    textShadowRadius: 8,
  },
});
