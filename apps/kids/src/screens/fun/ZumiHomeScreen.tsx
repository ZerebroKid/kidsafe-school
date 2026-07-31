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
import Svg, {Defs, LinearGradient, Rect, Stop} from 'react-native-svg';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {useAuthStore} from '../../state/authStore';
import {useChildProfile} from '../../context/ChildProfileContext';
import {
  compareTopicOrder,
  useChildClassId,
  useTodayAssignments,
  type AssignmentCard,
} from '../../firebase/study';
import {spacing} from '../../theme';
import type {StudyStackParamList} from '../../navigation/types';
import {ZiboMascot} from './components/ZiboMascot';

type Props = NativeStackScreenProps<StudyStackParamList, 'ZumiHome'>;

/**
 * - resolving: loading today's assignments
 * - none:      no assignments today
 * - returned:  a session FINISHED -> celebration ("Shabaash!")
 * - ready:     a session was aborted early (mic prompt, back button...) ->
 *              friendly "come play" screen, NOT the celebration.
 */
type Phase = 'resolving' | 'none' | 'returned' | 'ready';

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

export function ZumiHomeScreen({navigation, route}: Props) {
  const uid = useAuthStore(s => s.firebaseUid);
  const {childName} = useChildProfile();
  const classState = useChildClassId(uid);
  const assignmentsState = useTodayAssignments(classState.data?.classId ?? null);

  const [phase, setPhase] = useState<Phase>('resolving');
  const launchedRef = useRef(false);
  const assignmentsRef = useRef<AssignmentCard[]>([]);
  assignmentsRef.current = assignmentsState.data ?? [];

  // Session outcome reported back by ZumiVoice (see closeSession there).
  // Kept in a ref so the focus listener always reads the latest value.
  const sessionDone = route.params?.sessionDone === true;
  const sessionDoneRef = useRef(sessionDone);
  sessionDoneRef.current = sessionDone;

  // On tab focus after a launch: celebrate ONLY if the session actually
  // finished; an aborted session (e.g. exited at the mic-permission prompt)
  // gets the "come play" screen instead. If we're stuck on 'none' but never
  // launched, re-try by resetting to 'resolving'.
  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      if (launchedRef.current) {
        setPhase(sessionDoneRef.current ? 'returned' : 'ready');
      } else if (phase === 'none') {
        setPhase('resolving');
      }
    });
    return unsub;
  }, [navigation, phase]);

  // The sessionDone param can land AFTER the focus event on slow transitions;
  // upgrade to the celebration as soon as it arrives.
  useEffect(() => {
    if (sessionDone && launchedRef.current) setPhase('returned');
  }, [sessionDone]);

  const launch = useCallback(() => {
    const pick = pickFirstAssignment(assignmentsRef.current);
    if (pick) {
      launchedRef.current = true;
      // Consume the previous outcome so a later aborted session can't reuse
      // a stale `sessionDone: true`.
      navigation.setParams({sessionDone: undefined});
      navigation.navigate('ZumiVoice', toZumiParams(pick));
    } else {
      setPhase('none');
    }
  }, [navigation]);

  // Reels live on their own bottom tab; switch tabs instead of pushing the
  // Reels screen inside this Fun stack (which kept the Fun tab highlighted).
  const openReels = useCallback(() => {
    navigation.getParent()?.navigate('ReelsTab');
  }, [navigation]);

  // Resolve the first assigned topic but wait for the child to deliberately
  // press the existing Start CTA before navigating to ZumiVoice.
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
      <View style={styles.container}>
        <GradientBg />
        <SafeAreaView style={styles.safe}>
          <View style={styles.stage}>
            <ZiboMascot size={170} />
            <Text style={styles.title}>Shabaash,{'\n'}{childName || 'dost'}!</Text>
            <Text style={styles.subtitle}>Aaj ka kaam ho gaya ☀️</Text>
            <View style={styles.coinPill}>
              <Text style={styles.coinPillText}>🪙 +20 coins!</Text>
            </View>
            <Pressable
              onPress={launch}
              android_ripple={{color: 'rgba(139,92,246,0.15)'}}
              style={({pressed}) => [styles.cta, pressed && styles.ctaPressed]}>
              <Text style={styles.ctaText}>Phir se! ▶</Text>
            </Pressable>
            <Pressable
              onPress={openReels}
              android_ripple={{color: 'rgba(255,255,255,0.25)'}}
              style={({pressed}) => [
                styles.reelsCta,
                pressed && styles.reelsCtaPressed,
              ]}>
              <Text style={styles.reelsCtaText}>Watch Reels</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (phase === 'ready') {
    return (
      <View style={styles.container}>
        <GradientBg />
        <SafeAreaView style={styles.safe}>
          <View style={styles.stage}>
            <ZiboMascot size={170} />
            <Text style={styles.title}>{hello}</Text>
            <Text style={styles.subtitle}>
              Zumi tumhara wait kar raha hai. Chalo khelte hain!
            </Text>
            <Pressable
              onPress={launch}
              android_ripple={{color: 'rgba(139,92,246,0.15)'}}
              style={({pressed}) => [styles.cta, pressed && styles.ctaPressed]}>
              <Text style={styles.ctaText}>Chalo shuru karein! ▶</Text>
            </Pressable>
            <Pressable
              onPress={openReels}
              android_ripple={{color: 'rgba(255,255,255,0.25)'}}
              style={({pressed}) => [
                styles.reelsCta,
                pressed && styles.reelsCtaPressed,
              ]}>
              <Text style={styles.reelsCtaText}>Watch Reels</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (phase === 'none') {
    return (
      <View style={styles.container}>
        <GradientBg />
        <SafeAreaView style={styles.safe}>
          <View style={styles.stage}>
            <ZiboMascot size={170} />
            <Text style={styles.title}>{hello}</Text>
            <Text style={styles.subtitle}>
              Aaj koi kaam nahi hai. Tab tak reels dekho!
            </Text>
            <Pressable
              onPress={openReels}
              android_ripple={{color: 'rgba(255,255,255,0.25)'}}
              style={({pressed}) => [
                styles.reelsCta,
                pressed && styles.reelsCtaPressed,
              ]}>
              <Text style={styles.reelsCtaText}>Watch Reels</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // 'resolving' — Zumi shows while assignments load
  return (
    <View style={styles.container}>
      <GradientBg />
      <SafeAreaView style={styles.safe}>
        <View style={styles.stage}>
          <ZiboMascot size={170} />
          <Text style={styles.title}>{hello}</Text>
          <View style={styles.loadingRow}>
            <ActivityIndicator color="#ffffff" />
            <Text style={styles.subtitle}>Zumi aa raha hai…</Text>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

/** Purple-to-pink full-screen gradient matching the celebration design. */
function GradientBg() {
  return (
    <Svg style={StyleSheet.absoluteFill}>
      <Defs>
        <LinearGradient id="zumiBg" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#7c3aed" />
          <Stop offset="0.6" stopColor="#a855f7" />
          <Stop offset="1" stopColor="#ec4899" />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#zumiBg)" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#7c3aed'},
  safe: {flex: 1},
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  title: {
    fontSize: 34,
    fontWeight: '900',
    color: '#ffffff',
    textAlign: 'center',
    lineHeight: 42,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    lineHeight: 22,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  coinPill: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 18,
  },
  coinPillText: {fontSize: 15, fontWeight: '800', color: '#7c3aed'},
  cta: {
    marginTop: spacing.lg,
    alignSelf: 'stretch',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: 32,
    shadowColor: '#4c1d95',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: {width: 0, height: 6},
    elevation: 8,
  },
  ctaPressed: {backgroundColor: '#f3e8ff', transform: [{scale: 0.96}]},
  ctaText: {fontSize: 18, fontWeight: '800', color: '#7c3aed'},
  reelsCta: {
    marginTop: spacing.sm,
    alignSelf: 'stretch',
    alignItems: 'center',
    backgroundColor: '#ec4899',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: 32,
    shadowColor: '#be185d',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: {width: 0, height: 6},
    elevation: 8,
  },
  reelsCtaPressed: {backgroundColor: '#db2777', transform: [{scale: 0.96}]},
  reelsCtaText: {fontSize: 18, fontWeight: '800', color: '#ffffff'},
});
