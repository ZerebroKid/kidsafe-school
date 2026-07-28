/**
 * ZumiHomeScreen -- the Fun-mode (grade <= 6) landing screen.
 *
 * Instead of dropping young kids on the Study Mission list, the Fun tab opens
 * straight onto Zumi the cartoon character. This screen shows Zumi while it
 * loads today's assignments and picks the earliest-due one. The child chooses
 * when to begin the full `ZumiVoice` session; we never force-open a lesson on
 * landing. When there are no assignments it stays here with a friendly idle
 * character and a route to the existing reels experience.
 *
 * NOTE: we do NOT pre-check the topic doc for a `voiceStory` field here.
 * `ZumiVoiceScreen` already loads the topic via `useTopicContent` and shows a
 * graceful fallback when voiceStory is missing. Avoiding the pre-read removes a
 * fragile extra Firestore hop that was silently failing on cold starts.
 */

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {ActivityIndicator, Pressable, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {useAuthStore} from '../../state/authStore';
import {useChildProfile} from '../../context/ChildProfileContext';
import {
  compareTopicOrder,
  useChildClassId,
  useTodayAssignments,
  type AssignmentCard,
} from '../../firebase/study';
import {colors, spacing} from '../../theme';
import type {StudyStackParamList} from '../../navigation/types';
import {ZumiCharacter} from './components/ZumiCharacter';

type Props = NativeStackScreenProps<StudyStackParamList, 'ZumiHome'>;

type Phase = 'resolving' | 'ready' | 'none' | 'returned';

const ACCENT = '#8b5cf6';

/** Pick the earliest-due assignment from today's list. */
function pickFirstAssignment(assignments: AssignmentCard[]): AssignmentCard | null {
  if (assignments.length === 0) return null;
  const sorted = [...assignments].sort((a, b) => {
    if (a.dueAt !== b.dueAt) return a.dueAt - b.dueAt;
    return compareTopicOrder(a, b);
  });
  return sorted[0];
}

/** Build the route params ZumiVoice needs from an assignment. */
function toZumiParams(a: AssignmentCard) {
  return {
    assignmentId: a.id,
    curriculumId: a.curriculumId,
    chapterId: a.chapterId,
    topicId: a.topicId,
    topicName: a.topicName,
  };
}

export function ZumiHomeScreen({navigation}: Props) {
  const uid = useAuthStore(s => s.firebaseUid);
  const {childName} = useChildProfile();
  const classState = useChildClassId(uid);
  const assignmentsState = useTodayAssignments(classState.data?.classId ?? null);

  const [phase, setPhase] = useState<Phase>('resolving');
  const launchedRef = useRef(false);
  const assignmentsRef = useRef<AssignmentCard[]>([]);
  assignmentsRef.current = assignmentsState.data ?? [];

  // On tab focus: if we already launched a session, show the "play again" screen.
  // If we're stuck on 'none' but never launched (e.g. a stale state from a
  // previous render cycle), re-try by resetting to 'resolving'.
  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      if (launchedRef.current) {
        setPhase('returned');
      } else if (phase === 'none') {
        setPhase('resolving');
      }
    });
    return unsub;
  }, [navigation, phase]);

  const launch = useCallback(() => {
    const pick = pickFirstAssignment(assignmentsRef.current);
    if (pick) {
      launchedRef.current = true;
      navigation.navigate('ZumiVoice', toZumiParams(pick));
    } else {
      setPhase('none');
    }
  }, [navigation]);

  // Resolve a topic once today's assignments have loaded. We deliberately
  // wait for the child to press Start learning before navigating to ZumiVoice.
  // IMPORTANT: `assignmentsState.data` is null (not []) while the hook is
  // transitioning from a null classId to a real one — React runs the re-render
  // before the hook's useEffect fires the new Firestore subscription. We treat
  // data===null as "still loading" to avoid a false "no assignments" verdict.
  const assignmentsReady =
    !classState.loading &&
    !assignmentsState.loading &&
    assignmentsState.data !== null;

  useEffect(() => {
    if (phase !== 'resolving' || launchedRef.current) return;
    if (classState.loading) return;
    if (!classState.data) {
      setPhase('none');
      return;
    }
    if (!assignmentsReady) return;
    const pick = pickFirstAssignment(assignmentsState.data ?? []);
    if (pick) {
      setPhase('ready');
    } else {
      setPhase('none');
    }
  }, [
    phase,
    classState.loading,
    classState.data,
    assignmentsReady,
    assignmentsState.data,
    navigation,
  ]);

  const hello = childName ? `Hi ${childName}!` : 'Hi dost!';

  if (phase === 'returned') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.stage}>
          <ZumiCharacter state="celebrating" />
          <Text style={styles.title}>Shabaash, {childName || 'dost'}!</Text>
          <Text style={styles.subtitle}>
            Aaj ka kaam ho gaya. Phir se sunna hai?
          </Text>
          <Pressable
            onPress={launch}
            android_ripple={{color: 'rgba(139,92,246,0.25)'}}
            style={({pressed}) => [styles.cta, pressed && styles.ctaPressed]}>
            <Text style={styles.ctaText}>Phir se! ▶</Text>
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate('Reels')}
            android_ripple={{color: 'rgba(236,72,153,0.25)'}}
            style={({pressed}) => [
              styles.reelsCta,
              pressed && styles.reelsCtaPressed,
            ]}>
            <Text style={styles.ctaText}>Watch Reels</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (phase === 'none') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.stage}>
          <ZumiCharacter state="idle" />
          <Text style={styles.title}>{hello}</Text>
          <Text style={styles.subtitle}>
            Aaj koi kaam nahi hai. Tab tak reels dekho!
          </Text>
          <Pressable
            onPress={() => navigation.navigate('Reels')}
            android_ripple={{color: 'rgba(236,72,153,0.25)'}}
            style={({pressed}) => [
              styles.reelsCta,
              pressed && styles.reelsCtaPressed,
            ]}>
            <Text style={styles.ctaText}>Watch Reels</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (phase === 'ready') {
    const firstTopic = pickFirstAssignment(assignmentsState.data ?? []);
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.stage}>
          <ZumiCharacter state="idle" />
          <Text style={styles.title}>Hello, {childName || 'dost'}!</Text>
          <Text style={styles.subtitle}>
            I’m Zumi. Let’s make today’s learning fun.
          </Text>
          <View style={styles.topicPill}>
            <Text style={styles.topicPillLabel}>TODAY’S TOPIC</Text>
            <Text style={styles.topicPillTitle} numberOfLines={2}>
              {firstTopic?.topicName ?? 'Your learning adventure'}
            </Text>
          </View>
          <Pressable
            onPress={launch}
            android_ripple={{color: 'rgba(139,92,246,0.25)'}}
            style={({pressed}) => [styles.startCta, pressed && styles.ctaPressed]}>
            <Text style={styles.startCtaText}>Start learning</Text>
            <Text style={styles.startCtaArrow}>→</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // 'resolving' — Zumi shows while assignments load
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.stage}>
        <ZumiCharacter state="idle" />
        <Text style={styles.title}>{hello}</Text>
        <View style={styles.loadingRow}>
          <ActivityIndicator color={ACCENT} />
          <Text style={styles.subtitle}>Zumi aa raha hai…</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.bg},
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cta: {
    marginTop: spacing.lg,
    backgroundColor: ACCENT,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: 32,
    shadowColor: ACCENT,
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: {width: 0, height: 6},
    elevation: 8,
  },
  ctaPressed: {backgroundColor: '#7c3aed', transform: [{scale: 0.96}]},
  ctaText: {fontSize: 18, fontWeight: '800', color: '#ffffff'},
  reelsCta: {
    marginTop: spacing.sm,
    backgroundColor: '#ec4899',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: 32,
    shadowColor: '#ec4899',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: {width: 0, height: 6},
    elevation: 8,
  },
  reelsCtaPressed: {backgroundColor: '#db2777', transform: [{scale: 0.96}]},
  topicPill: {
    width: '100%',
    borderRadius: 18,
    padding: spacing.md,
    backgroundColor: '#f0edff',
    gap: 4,
  },
  topicPillLabel: {fontSize: 11, fontWeight: '800', color: ACCENT, letterSpacing: 0.8},
  topicPillTitle: {fontSize: 15, lineHeight: 21, color: colors.text, fontWeight: '800'},
  startCta: {
    width: '100%',
    minHeight: 58,
    paddingHorizontal: spacing.lg,
    backgroundColor: '#ffd84d',
    borderRadius: 29,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#d6ad11',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: {width: 0, height: 6},
    elevation: 5,
  },
  startCtaText: {fontSize: 18, fontWeight: '800', color: '#332600'},
  startCtaArrow: {fontSize: 25, fontWeight: '800', color: '#332600'},
});
