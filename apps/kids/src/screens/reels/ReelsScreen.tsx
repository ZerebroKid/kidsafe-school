/**
 * ReelsScreen — Instagram-Reels-style vertical video feed.
 *
 * Uses `react-native-reanimated-carousel` for smooth vertical paging and
 * `react-native-video` for native playback. Only the active item plays;
 * neighbors show poster thumbnails.
 *
 * Watch time is tracked per-topic and flushed to Firestore on item change,
 * screen blur, and unmount via the `watchTracker` service.
 */

import React, {useCallback, useRef, useState} from 'react';
import {ActivityIndicator, Dimensions, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Carousel from 'react-native-reanimated-carousel';
import type {OnProgressData} from 'react-native-video';
// NOTE: imported from `@react-navigation/core` (not `/native`). Under this
// project's TS config (`moduleResolution: bundler` + react-native condition),
// native's `export * from '@react-navigation/core'` fails to surface these two
// hooks. Core is a single hoisted copy, so the module/context instance is the
// same one `@react-navigation/native` uses at runtime.
import {useFocusEffect, useIsFocused} from '@react-navigation/core';

import {useChildProfile} from '../../context/ChildProfileContext';
import {useReelsFeed, markSeen} from '../../firebase/reels';
import {WatchTracker} from '../../services/reels/watchTracker';
import type {ReelDoc} from '@zerebro/shared-types';
import {ReelItem} from './components/ReelItem';
import {colors} from '../../theme';

const {width: SCREEN_W, height: SCREEN_H} = Dimensions.get('window');

export function ReelsScreen() {
  const {childGrade} = useChildProfile();
  const {data: feed, loading, error} = useReelsFeed(childGrade);
  const isScreenFocused = useIsFocused();
  const [activeIndex, setActiveIndex] = useState(0);
  const trackerRef = useRef<WatchTracker | null>(null);

  if (!trackerRef.current) {
    trackerRef.current = new WatchTracker();
  }
  const tracker = trackerRef.current;

  // Flush on screen blur / unmount
  useFocusEffect(
    useCallback(() => {
      return () => {
        tracker.flush();
      };
    }, [tracker]),
  );

  const handleSnapToItem = useCallback(
    (index: number) => {
      tracker.flush();
      setActiveIndex(index);

      const reel = feed?.[index];
      if (reel) {
        markSeen(reel.reelId);
        tracker.setActiveReel(reel);
      }
    },
    [feed, tracker],
  );

  const handleProgress = useCallback(
    (data: OnProgressData) => {
      tracker.onProgress(data.currentTime);
    },
    [tracker],
  );

  // Set the initial reel when feed loads
  React.useEffect(() => {
    if (feed && feed.length > 0 && activeIndex === 0) {
      tracker.setActiveReel(feed[0]);
      markSeen(feed[0].reelId);
    }
  }, [feed, activeIndex, tracker]);

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading reels...</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.errorText}>Could not load reels</Text>
      </SafeAreaView>
    );
  }

  if (!feed || feed.length === 0) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.emptyText}>No reels available right now</Text>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <Carousel
        data={feed}
        renderItem={({item, index}: {item: ReelDoc; index: number}) => (
          <ReelItem
            reel={item}
            isActive={index === activeIndex}
            screenFocused={isScreenFocused}
            preload={index === activeIndex + 1}
            onProgress={index === activeIndex ? handleProgress : undefined}
          />
        )}
        width={SCREEN_W}
        height={SCREEN_H}
        vertical
        loop={false}
        onSnapToItem={handleSnapToItem}
        windowSize={3}
        pagingEnabled
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  errorText: {
    color: colors.danger,
    fontSize: 14,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 16,
  },
});
