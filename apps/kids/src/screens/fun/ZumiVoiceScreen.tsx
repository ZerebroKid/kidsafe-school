/**
 * ZumiVoiceScreen -- the fullscreen Zumi voice "Fun" session (grade <= 6).
 *
 * Thin view over `ZumiSessionManager`: it loads the topic's `voiceStory`,
 * spins up the manager, and renders whatever the manager emits (avatar state,
 * speech bubble, Lottie cue, quiz progress). All speech/AI/timing lives in the
 * manager + services; this file only maps events to React state and handles
 * lifecycle (start once, abort on unmount/back).
 */

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  AppState,
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {useTopicContent} from '../../firebase/study';
import {useChildProfile} from '../../context/ChildProfileContext';
import {Button} from '../../components/Button';
import {colors, radius, spacing} from '../../theme';
import type {StudyStackParamList} from '../../navigation/types';
import {
  ZumiSessionManager,
  type AvatarState,
  type SessionState,
} from '../../services/zumi/zumiSessionManager';
import {ZumiPlayground} from './components/ZumiPlayground';
import {ZumiSpeechBubble} from './components/ZumiSpeechBubble';
import {
  ZumiSceneCue,
  ZumiCelebration,
  type ZumiCueData,
} from './components/ZumiCue';
import {QuizProgressBar} from './components/QuizProgressBar';

type Props = NativeStackScreenProps<StudyStackParamList, 'ZumiVoice'>;

interface DoneInfo {
  percentage: number;
  passed: boolean;
  score: number;
  maxScore: number;
}

const ACCENT = '#8b5cf6';

export function ZumiVoiceScreen({route, navigation}: Props) {
  const {assignmentId, curriculumId, chapterId, topicId, topicName} =
    route.params;
  const {childName, loading: profileLoading} = useChildProfile();
  const {data: topic, loading, error} = useTopicContent(
    curriculumId,
    chapterId,
    topicId,
  );

  const [sessionState, setSessionState] = useState<SessionState>('init');
  const [avatar, setAvatar] = useState<AvatarState>('idle');
  const [bubble, setBubble] = useState('');
  const [cue, setCue] = useState<ZumiCueData | null>(null);
  const [listening, setListening] = useState(false);
  const [listenMode, setListenMode] = useState<'auto' | 'tap'>('auto');
  const [speaking, setSpeaking] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [prompt, setPrompt] = useState<{skippable: boolean; hint?: string} | null>(
    null,
  );
  const [quiz, setQuiz] = useState<{current: number; total: number; score: number} | null>(
    null,
  );
  const [done, setDone] = useState<DoneInfo | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const managerRef = useRef<ZumiSessionManager | null>(null);
  const startedRef = useRef(false);
  const closedRef = useRef(false);
  const bubbleScrollRef = useRef<ScrollView | null>(null);

  // Reset the bubble scroll to the top whenever Zumi says a new line, so the
  // child always sees the start of a long script rather than a mid-scroll
  // position left over from the previous line.
  useEffect(() => {
    bubbleScrollRef.current?.scrollTo({y: 0, animated: false});
  }, [bubble]);

  const voiceStory = topic?.voiceStory ?? null;

  // Start the session exactly once, after the topic + profile have resolved.
  useEffect(() => {
    if (startedRef.current) return;
    if (loading || profileLoading) return;
    if (!voiceStory) return;

    startedRef.current = true;
    const manager = new ZumiSessionManager(
      {assignmentId, topicName, story: voiceStory, childName},
      event => {
        switch (event.type) {
          case 'state':
            setSessionState(event.state);
            break;
          case 'avatar':
            setAvatar(event.avatar);
            break;
          case 'bubble':
            setBubble(event.text);
            break;
          case 'cue':
            setCue(event.cue);
            break;
          case 'listening':
            setListening(event.on);
            if (event.on) {
              setListenMode(event.mode ?? 'tap');
              setSpeaking(!!event.speaking);
            } else {
              setSpeaking(false);
            }
            break;
          case 'transcribing':
            setTranscribing(event.on);
            break;
          case 'prompt':
            setPrompt(
              event.waiting
                ? {skippable: event.skippable, hint: event.hint}
                : null,
            );
            break;
          case 'quiz':
            setQuiz({
              current: event.current,
              total: event.total,
              score: event.score,
            });
            break;
          case 'done':
            setDone({
              percentage: event.percentage,
              passed: event.passed,
              score: event.score,
              maxScore: event.maxScore,
            });
            break;
          case 'error':
            setSessionError(event.message);
            break;
        }
      },
    );
    managerRef.current = manager;
    void manager.start();
  }, [
    loading,
    profileLoading,
    voiceStory,
    assignmentId,
    topicName,
    childName,
  ]);

  // Single teardown path. Stops all audio/recording, cancels timers, and ends
  // the flow -- then optionally leaves the screen. Guarded so the many triggers
  // (X button, hardware back, tab switch, app backgrounded, unmount) run it at
  // most once per mount. Re-entering the screen remounts it with a fresh guard.
  const closeSession = useCallback(
    (navigateBack: boolean) => {
      if (closedRef.current) return;
      closedRef.current = true;
      managerRef.current?.abort();
      if (navigateBack && navigation.canGoBack()) navigation.goBack();
    },
    [navigation],
  );

  const exit = useCallback(() => closeSession(true), [closeSession]);

  // Abort on unmount (no navigation -- the screen is already gone).
  useEffect(() => {
    return () => closeSession(false);
  }, [closeSession]);

  // Leaving the screen (switching to Home/Study tab or navigating away) must
  // end the session entirely so Zumi stops talking and re-entry starts fresh.
  useEffect(() => {
    const unsub = navigation.addListener('blur', () => closeSession(true));
    return unsub;
  }, [navigation, closeSession]);

  // Backgrounding/closing the app also fully ends the session (Android keeps
  // audio playing otherwise).
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'background') closeSession(true);
    });
    return () => sub.remove();
  }, [closeSession]);

  const onTapTalk = useCallback(() => {
    void managerRef.current?.tapTalk();
  }, []);

  const onStopAuto = useCallback(() => {
    managerRef.current?.stopListening();
  }, []);

  const onSkip = useCallback(() => {
    managerRef.current?.skipTurn();
  }, []);

  // Hardware back ends the session cleanly.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      exit();
      return true;
    });
    return () => sub.remove();
  }, [exit]);

  // ---- render -------------------------------------------------------------

  if (loading || profileLoading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={ACCENT} />
        <Text style={styles.mutedText}>Zumi aa raha hai…</Text>
      </SafeAreaView>
    );
  }

  if (error || !topic || !voiceStory) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.bigEmoji}>😕</Text>
        <Text style={styles.title}>Zumi abhi ready nahi hai</Text>
        <Text style={styles.mutedText}>
          {error ?? 'Is topic ke liye Zumi story nahi mili.'}
        </Text>
        <Button
          title="Wapas jao"
          variant="secondary"
          onPress={() => navigation.goBack()}
          style={{marginTop: 20}}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topRow}>
        <Text style={styles.topicLabel} numberOfLines={1}>
          {topicName}
        </Text>
        <Pressable
          onPress={exit}
          hitSlop={12}
          android_ripple={{color: 'rgba(0,0,0,0.08)', borderless: true}}>
          <Text style={styles.close}>✕</Text>
        </Pressable>
      </View>

      <View style={styles.stage}>
        <View style={styles.orbZone}>
          <ZumiPlayground state={avatar} />
          {/* Scene animation drawn ON TOP of the mascot so it is clearly
              visible (Lottie clips are transparent, so the mascot still shows
              behind). pointerEvents:none keeps the playground tappable. */}
          <ZumiSceneCue cue={cue} />
          <ZumiCelebration show={avatar === 'celebrating'} />
        </View>

        <ScrollView
          ref={bubbleScrollRef}
          style={styles.bubbleScroll}
          contentContainerStyle={styles.bubbleScrollContent}
          showsVerticalScrollIndicator={false}>
          <ZumiSpeechBubble text={bubble} />
        </ScrollView>
      </View>

      <View style={styles.bottom}>
        {sessionState === 'quiz' && quiz ? (
          <QuizProgressBar
            current={quiz.current}
            total={quiz.total}
            score={quiz.score}
          />
        ) : null}

        {transcribing ? (
          <View style={styles.micArea}>
            <View style={[styles.micButton, styles.micButtonThinking]}>
              <ActivityIndicator size="large" color="#ffffff" />
            </View>
            <Text style={styles.listenHint}>Samajh raha hoon…</Text>
          </View>
        ) : listening && listenMode === 'auto' ? (
          <View style={styles.micArea}>
            <Pressable
              onPress={onStopAuto}
              hitSlop={12}
              android_ripple={{
                color: 'rgba(231,0,11,0.25)',
                borderless: true,
              }}
              style={({pressed}) => [
                styles.micButton,
                styles.micButtonActive,
                speaking && styles.micButtonSpeaking,
                pressed && styles.micButtonPressed,
              ]}>
              <Text style={styles.micGlyph}>⏹</Text>
            </Pressable>
            <Text style={styles.recordingLabel}>
              {speaking ? '● Sun raha hoon…' : '🎧 Bolo, main sun raha hoon'}
            </Text>
            <Text style={styles.autoHint}>Bol ke ruk jao — main samajh jaunga</Text>
          </View>
        ) : listening ? (
          <View style={styles.micArea}>
            <Pressable
              onPress={onTapTalk}
              hitSlop={12}
              android_ripple={{
                color: 'rgba(231,0,11,0.25)',
                borderless: true,
              }}
              style={({pressed}) => [
                styles.micButton,
                styles.micButtonActive,
                pressed && styles.micButtonPressed,
              ]}>
              <Text style={styles.micGlyph}>⏹</Text>
            </Pressable>
            <Text style={styles.recordingLabel}>● Sun raha hoon… ho gaya? Tap karo</Text>
          </View>
        ) : prompt ? (
          <View style={styles.micArea}>
            <Pressable
              onPress={onTapTalk}
              hitSlop={12}
              android_ripple={{
                color: 'rgba(139,92,246,0.25)',
                borderless: true,
              }}
              style={({pressed}) => [
                styles.micButton,
                pressed && styles.micButtonPressed,
              ]}>
              <Text style={styles.micGlyph}>🎙️</Text>
            </Pressable>
            <Text style={styles.micLabel}>
              {prompt.hint ?? 'Bolne ke liye dabao'}
            </Text>
            {prompt.skippable ? (
              <Pressable
                onPress={onSkip}
                hitSlop={10}
                android_ripple={{color: 'rgba(0,0,0,0.06)'}}
                style={styles.skipButton}>
                <Text style={styles.skipText}>Aage badho ▶</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>

      {sessionError && !done ? (
        <View style={styles.overlay}>
          <Text style={styles.bigEmoji}>😴</Text>
          <Text style={styles.title}>Oops!</Text>
          <Text style={styles.overlayText}>{sessionError}</Text>
          <Button
            title="Theek hai"
            onPress={exit}
            style={{marginTop: 20, maxWidth: 240}}
          />
        </View>
      ) : null}

      {done ? (
        <View style={styles.overlay}>
          <Text style={styles.bigEmoji}>{done.passed ? '🎉' : '💪'}</Text>
          <Text style={styles.doneScore}>
            {done.score} / {done.maxScore}
          </Text>
          <Text style={styles.doneTitle}>
            {done.passed ? 'Shabaash!' : 'Acchi koshish!'}
          </Text>
          <Text style={styles.overlayText}>
            {done.passed
              ? 'Tumne kamaal kar diya! Kal phir milte hain.'
              : 'Tum bahut brave ho! Kal phir try karenge.'}
          </Text>
          <Button
            title="Ho gaya"
            onPress={() => navigation.goBack()}
            style={{marginTop: 24, maxWidth: 240}}
          />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.bg, paddingHorizontal: spacing.lg},
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
  },
  topicLabel: {
    flex: 1,
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '600',
  },
  close: {fontSize: 22, color: colors.textMuted, paddingHorizontal: spacing.sm},
  stage: {
    flex: 1,
  },
  orbZone: {
    height: 240,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleScroll: {
    flex: 1,
    alignSelf: 'stretch',
  },
  bubbleScrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  bottom: {
    paddingBottom: spacing.lg,
    minHeight: 48,
    justifyContent: 'center',
    gap: spacing.md,
  },
  micArea: {alignItems: 'center', gap: spacing.sm, paddingTop: spacing.xs},
  micButton: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ACCENT,
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: {width: 0, height: 6},
    elevation: 8,
  },
  micButtonPressed: {backgroundColor: '#7c3aed', transform: [{scale: 0.94}]},
  micButtonActive: {
    backgroundColor: colors.danger,
    shadowColor: colors.danger,
  },
  micButtonThinking: {backgroundColor: '#7c3aed'},
  micButtonSpeaking: {transform: [{scale: 1.06}]},
  micGlyph: {fontSize: 36, color: '#ffffff'},
  recordingLabel: {
    fontSize: 16,
    color: colors.danger,
    fontWeight: '800',
    textAlign: 'center',
  },
  autoHint: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
  },
  micLabel: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '700',
    textAlign: 'center',
    maxWidth: 300,
  },
  skipButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
  },
  skipText: {fontSize: 14, color: colors.textMuted, fontWeight: '600'},
  listenHint: {fontSize: 15, color: ACCENT, fontWeight: '700'},
  mutedText: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  bigEmoji: {fontSize: 64},
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.97)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  overlayText: {
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  doneScore: {fontSize: 44, fontWeight: '800', color: ACCENT},
  doneTitle: {fontSize: 24, fontWeight: '800', color: colors.text},
});
