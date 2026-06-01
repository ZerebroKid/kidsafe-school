import React, {useEffect, useState} from 'react';
import {ActivityIndicator, StyleSheet, Text, View} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {Button} from '../../components/Button';
import {useRewardUnlock} from '../../firebase/study';
import {colors, radius, spacing} from '../../theme';
import type {StudyStackParamList} from '../../navigation/types';

type Props = NativeStackScreenProps<StudyStackParamList, 'RewardUnlock'>;

// How long to wait for the onQuizAttemptWrite trigger to land before showing
// the "no reward this time" fallback. The trigger usually fires within a few
// seconds; 15s is a comfortable upper bound on a slow connection.
const UNLOCK_TIMEOUT_MS = 15000;

/**
 * P4.10.3 / P4.10.4 -- reward unlock screen.
 *
 * The child reaches here only after passing (>= 60%). The reward is written
 * asynchronously by the `onQuizAttemptWrite` trigger, so we subscribe to
 * `rewardUnlocks/{attemptId}` and light up the moment it lands. If nothing
 * arrives within the timeout (e.g. no eligible reward in the catalogue), we
 * still celebrate the pass with a friendly fallback -- never a dead end.
 *
 * Playback stays IN-APP: youtube_link rewards reuse the distraction-free
 * VideoPlayer; other links open in a sandboxed in-app WebView.
 */
export function RewardUnlockScreen({route, navigation}: Props) {
  const {attemptId, topicName} = route.params;
  const {data: reward, loading} = useRewardUnlock(attemptId);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (reward) return;
    const t = setTimeout(() => setTimedOut(true), UNLOCK_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [reward]);

  const openReward = () => {
    if (!reward) return;
    if (reward.rewardType === 'youtube_link') {
      navigation.navigate('VideoPlayer', {
        videoUrl: reward.rewardUrl,
        title: reward.rewardTitle,
      });
    } else {
      navigation.navigate('RewardWebView', {
        url: reward.rewardUrl,
        title: reward.rewardTitle,
      });
    }
  };

  // Reward arrived.
  if (reward) {
    return (
      <View style={styles.centered}>
        <Text style={styles.bigEmoji}>🎁</Text>
        <Text style={styles.title}>Reward unlocked!</Text>
        <Text style={styles.subtitle}>
          Great work on {topicName}. Here&apos;s a treat just for you:
        </Text>
        <View style={styles.rewardCard}>
          <Text style={styles.rewardTitle}>{reward.rewardTitle}</Text>
        </View>
        <View style={styles.actions}>
          <Button
            title={
              reward.rewardType === 'youtube_link'
                ? 'Watch now'
                : 'Open reward'
            }
            onPress={openReward}
          />
          <Button
            title="Done"
            variant="secondary"
            onPress={() => navigation.popToTop()}
          />
        </View>
      </View>
    );
  }

  // Still waiting and not yet timed out.
  if (loading || !timedOut) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.title}>Unlocking your reward…</Text>
        <Text style={styles.subtitle}>Hang tight for a second!</Text>
      </View>
    );
  }

  // Passed, but no reward available.
  return (
    <View style={styles.centered}>
      <Text style={styles.bigEmoji}>🌟</Text>
      <Text style={styles.title}>You passed!</Text>
      <Text style={styles.subtitle}>
        Awesome work on {topicName}. There&apos;s no reward to unlock right now,
        but keep it up — more are on the way!
      </Text>
      <View style={styles.actions}>
        <Button title="Done" onPress={() => navigation.popToTop()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  bigEmoji: {fontSize: 64},
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 21,
    paddingHorizontal: spacing.md,
  },
  rewardCard: {
    width: '100%',
    marginTop: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
  },
  rewardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  actions: {
    width: '100%',
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
});
