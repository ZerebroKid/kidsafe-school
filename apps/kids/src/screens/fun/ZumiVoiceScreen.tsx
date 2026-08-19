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
  useWindowDimensions,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Video, {type ReactVideoProps} from 'react-native-video';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {useTopicContent} from '../../firebase/study';
import {useChildProfile} from '../../context/ChildProfileContext';
import {colors, radius, spacing} from '../../theme';
import type {StudyStackParamList} from '../../navigation/types';
import {
  ZumiSessionManager,
  type AvatarState,
  type SessionState,
} from '../../services/zumi/zumiSessionManager';
import {isZumiLive} from '../../services/zumi/zumiConfig';
import {ZumiLiveSession} from '../../services/zumi/zumiLiveSession';
import {isMicPromptActive} from '../../services/zumi/zumiSpeech';
import {FunBackground} from './components/FunBackground';
import {ZumiPlayground} from './components/ZumiPlayground';
import {ZumiSpeechBubble} from './components/ZumiSpeechBubble';
import {
  ZumiSceneCue,
  ZumiCelebration,
  type ZumiCueData,
} from './components/ZumiCue';
import {QuizProgressBar} from './components/QuizProgressBar';

type Props = NativeStackScreenProps<StudyStackParamList, 'ZumiVoice'>;

// react-native-video ships types built against @types/react 19, while the
// mobile apps pin @types/react 18 (see ReelItem.tsx for the same bridge).
// A bundled asset id (Metro `require` of an mp4) is a number at runtime.
const VideoPlayer = Video as unknown as React.ComponentType<
  Omit<ReactVideoProps, 'source'> & {source: number}
>;

/** The subset of the session manager surface the screen drives. */
type ZumiSessionLike = Pick<
  ZumiSessionManager,
  'start' | 'abort' | 'tapTalk' | 'stopListening' | 'skipTurn' | 'notifyVideoDone'
>;

interface DoneInfo {
  percentage: number;
  passed: boolean;
  score: number;
  maxScore: number;
}

export function ZumiVoiceScreen({route, navigation}: Props) {
  const {assignmentId, curriculumId, chapterId, topicId, topicName} =
    route.params;
  const {width: windowWidth} = useWindowDimensions();
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
  const [video, setVideo] = useState<number | null>(null);
  const [done, setDone] = useState<DoneInfo | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const managerRef = useRef<ZumiSessionLike | null>(null);
  const startedRef = useRef(false);
  const closedRef = useRef(false);
  // True once the session reached its natural end ('done' event) -- reported
  // back to ZumiHome so it only celebrates genuinely finished sessions.
  const doneRef = useRef(false);
  const bubbleScrollRef = useRef<ScrollView | null>(null);

  // Reset the bubble scroll to the top whenever Zumi says a new line, so the
  // child always sees the start of a long script rather than a mid-scroll
  // position left over from the previous line.
  useEffect(() => {
    bubbleScrollRef.current?.scrollTo({y: 0, animated: false});
  }, [bubble]);

  const voiceStory = topic?.voiceStory ?? null;

  // Start the session exactly once, after the topic + profile have resolved.
  // Pipeline choice comes from Firestore appConfig/zumi (see zumiConfig.ts)
  // so we can flip live <-> legacy without an app release.
  useEffect(() => {
    if (startedRef.current) return;
    if (loading || profileLoading) return;
    if (!voiceStory) return;

    let cancelled = false;

    void (async () => {
      const live = await isZumiLive();
      if (cancelled || closedRef.current || startedRef.current) return;
      startedRef.current = true;

      // live: streaming LiveKit session (Python agent); legacy: callable
      // ZumiSessionManager. Both share the same event surface for this screen.
      const SessionImpl = live ? ZumiLiveSession : ZumiSessionManager;
      const manager = new SessionImpl(
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
            case 'video':
              setVideo(event.source);
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
              doneRef.current = true;
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
    })();

    return () => {
      cancelled = true;
    };
  }, [
    loading,
    profileLoading,
    voiceStory,
    assignmentId,
    topicName,
    childName,
  ]);

  // Leave the screen, back to ZumiHome when it's below us in the stack, WITH
  // the session outcome so it can distinguish "finished" from "aborted early"
  // (e.g. exited during the mic-permission prompt).
  // MUST be popTo, not navigate: react-navigation v7's navigate PUSHES a
  // fresh ZumiHome on top, which auto-launched a brand-new session -- an
  // infinite ZumiHome/ZumiVoice loop with dueling LiveKit connections.
  const goHome = useCallback(() => {
    if (!navigation.canGoBack()) return;
    const routes: Array<{name: string}> = navigation.getState?.()?.routes ?? [];
    if (routes.some(r => r.name === 'ZumiHome')) {
      navigation.popTo('ZumiHome', {sessionDone: doneRef.current});
    } else {
      navigation.goBack();
    }
  }, [navigation]);

  // Single teardown path. Stops all audio/recording, cancels timers, and ends
  // the flow -- then optionally leaves the screen. Only the ABORT is guarded
  // to run once per mount; navigation must stay repeatable, otherwise a
  // background kill (phone call, app switch) that couldn't navigate at the
  // time left the X button permanently dead on a zombie session screen.
  const closeSession = useCallback(
    (navigateBack: boolean) => {
      if (!closedRef.current) {
        closedRef.current = true;
        managerRef.current?.abort();
      }
      if (navigateBack) goHome();
    },
    [goHome],
  );

  const exit = useCallback(() => closeSession(true), [closeSession]);

  // Abort on unmount (no navigation -- the screen is already gone).
  useEffect(() => {
    return () => closeSession(false);
  }, [closeSession]);

  // Leaving the screen (switching to Home/Study tab or navigating away) must
  // end the session entirely so Zumi stops talking and re-entry starts fresh.
  // No navigation here: the screen is already blurring, and the Fun tab press
  // pops its stack to ZumiHome anyway (see MainTabNavigator's tabPress).
  useEffect(() => {
    const unsub = navigation.addListener('blur', () => closeSession(false));
    return unsub;
  }, [navigation, closeSession]);

  // Backgrounding/closing the app also fully ends the session (Android keeps
  // audio playing otherwise). EXCEPT while the mic-permission dialog is up:
  // the OS dialog pauses the activity (AppState 'background' on many OEMs),
  // and killing the session there bounced the child straight back out of a
  // session that never got to start.
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'background' && !isMicPromptActive()) {
        closeSession(true);
      } else if (state === 'active' && closedRef.current) {
        // Coming back to a session that was killed while backgrounded (phone
        // call, app switch): the navigate-away may have been dropped by the
        // OS, leaving a dead session on screen. Leave it now.
        goHome();
      }
    });
    return () => sub.remove();
  }, [closeSession, goHome]);

  const onTapTalk = useCallback(() => {
    void managerRef.current?.tapTalk();
  }, []);

  const onStopAuto = useCallback(() => {
    managerRef.current?.stopListening();
  }, []);

  const onSkip = useCallback(() => {
    managerRef.current?.skipTurn();
  }, []);

  const onVideoDone = useCallback(() => {
    managerRef.current?.notifyVideoDone();
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

  // 'init' covers the live-session warmup too (token + WebRTC connect + agent
  // dispatch + first LLM/TTS turn): the loader stays up until the moment
  // Zumi's first word starts playing, so the child never sees a silent mascot.
  if (loading || profileLoading || (!error && voiceStory && sessionState === 'init')) {
    return (
      <View style={styles.root}>
        <FunBackground />
        <SafeAreaView style={styles.center}>
          <ActivityIndicator size="large" color="#ffffff" />
          <Text style={styles.mutedText}>Zumi aa raha hai…</Text>
        </SafeAreaView>
      </View>
    );
  }

  if (error || !topic || !voiceStory) {
    return (
      <View style={styles.root}>
        <FunBackground />
        <SafeAreaView style={styles.center}>
          <Text style={styles.bigEmoji}>😕</Text>
          <Text style={styles.title}>Zumi is not ready yet</Text>
          <Text style={styles.mutedText}>
            {error ?? 'No Zumi story found for this topic.'}
          </Text>
          <Pressable
            onPress={() => navigation.goBack()}
            android_ripple={{color: 'rgba(139,92,246,0.15)'}}
            style={({pressed}) => [
              styles.whiteCta,
              pressed && styles.whiteCtaPressed,
            ]}>
            <Text style={styles.whiteCtaText}>Wapas jao</Text>
          </Pressable>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <FunBackground />
      <SafeAreaView style={styles.container}>
      <View style={styles.topRow}>
        <Text style={styles.topicLabel} numberOfLines={1}>
          {topicName}
        </Text>
        <Pressable
          onPress={exit}
          hitSlop={12}
          android_ripple={{color: 'rgba(255,255,255,0.2)', borderless: true}}
          style={styles.closeChip}>
          <Text style={styles.close}>✕</Text>
        </Pressable>
      </View>

      <View style={styles.stage}>
        {/* Video mode: the mascot steps aside entirely and the video becomes
            the hero -- near-full-width 16:9 (the bundled clips are 1024x576),
            vertically centered on the stage. Plain Views on purpose:
            reanimated entering/exiting animations here crashed Fabric
            ("Unable to find viewState for tag") when the card unmounted
            mid-animation (skip tap or navigation away). */}
        {video != null ? (
          <View style={styles.videoStage}>
            <View style={[styles.videoCard, {width: windowWidth - 12}]}>
              <VideoPlayer
                source={video}
                style={styles.videoCardPlayer}
                resizeMode="cover"
                controls={false}
                paused={false}
                onEnd={onVideoDone}
                onError={onVideoDone}
              />
            </View>
            <Text style={styles.videoCaption}>
              🍿 Video dekho, phir aage badhenge!
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.orbZone}>
              <ZumiPlayground state={avatar} />
              {/* Scene animation drawn ON TOP of the mascot so it is clearly
                  visible (Lottie clips are transparent, so the mascot still
                  shows behind). pointerEvents:none keeps the playground
                  tappable. */}
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
          </>
        )}
      </View>

      <View style={styles.bottom}>
        {video != null ? (
          <View style={styles.micArea}>
            <Pressable
              onPress={onVideoDone}
              hitSlop={10}
              android_ripple={{color: 'rgba(139,92,246,0.25)'}}
              style={({pressed}) => [
                styles.videoSkipButton,
                pressed && styles.micButtonPressed,
              ]}>
              <Text style={styles.videoSkipButtonText}>Aage badho ▶</Text>
            </Pressable>
          </View>
        ) : (
          <>
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
          </>
        )}
      </View>

      {sessionError && !done ? (
        <View style={styles.overlay}>
          <FunBackground />
          <Text style={styles.bigEmoji}>😴</Text>
          <Text style={styles.title}>Oops!</Text>
          <Text style={styles.overlayText}>{sessionError}</Text>
          <Pressable
            onPress={exit}
            android_ripple={{color: 'rgba(139,92,246,0.15)'}}
            style={({pressed}) => [
              styles.whiteCta,
              pressed && styles.whiteCtaPressed,
            ]}>
            <Text style={styles.whiteCtaText}>Theek hai</Text>
          </Pressable>
        </View>
      ) : null}

      {done ? (
        <View style={styles.overlay}>
          <FunBackground variant="celebration" />
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
          <Pressable
            onPress={exit}
            android_ripple={{color: 'rgba(139,92,246,0.15)'}}
            style={({pressed}) => [
              styles.whiteCta,
              pressed && styles.whiteCtaPressed,
            ]}>
            <Text style={styles.whiteCtaText}>Ho gaya ▶</Text>
          </Pressable>
        </View>
      ) : null}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#7c3aed'},
  container: {flex: 1, paddingHorizontal: spacing.lg},
  center: {
    flex: 1,
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
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '700',
  },
  closeChip: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  close: {fontSize: 18, color: '#ffffff', fontWeight: '700'},
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
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4c1d95',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: {width: 0, height: 6},
    elevation: 8,
  },
  micButtonPressed: {backgroundColor: '#f3e8ff', transform: [{scale: 0.94}]},
  micButtonActive: {
    backgroundColor: colors.danger,
    shadowColor: colors.danger,
  },
  micButtonThinking: {backgroundColor: 'rgba(255,255,255,0.25)'},
  micButtonSpeaking: {transform: [{scale: 1.06}]},
  micGlyph: {fontSize: 36, color: '#ffffff'},
  recordingLabel: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '800',
    textAlign: 'center',
  },
  autoHint: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
  },
  micLabel: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '700',
    textAlign: 'center',
    maxWidth: 300,
  },
  skipButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  skipText: {fontSize: 14, color: '#ffffff', fontWeight: '700'},
  listenHint: {fontSize: 15, color: '#ffffff', fontWeight: '700'},
  mutedText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
  },
  bigEmoji: {fontSize: 64},
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  overlayText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    lineHeight: 22,
  },
  doneScore: {fontSize: 44, fontWeight: '900', color: '#fbbf24'},
  doneTitle: {fontSize: 26, fontWeight: '900', color: '#ffffff'},
  whiteCta: {
    marginTop: spacing.lg,
    minWidth: 220,
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
  whiteCtaPressed: {backgroundColor: '#f3e8ff', transform: [{scale: 0.96}]},
  whiteCtaText: {fontSize: 17, fontWeight: '800', color: '#7c3aed'},
  // Bleeds past the container's horizontal padding so the video can use
  // nearly the whole screen width.
  videoStage: {
    flex: 1,
    marginHorizontal: -spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  videoCard: {
    // Taller than the clips' native 16:9 (1024x576): with resizeMode "cover"
    // the video zooms to fill the 4:3 frame, trading a slim crop off the
    // sides for a much bigger, easier-to-see picture on a portrait phone.
    aspectRatio: 4 / 3,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
    padding: 5,
    shadowColor: '#4c1d95',
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: {width: 0, height: 8},
    elevation: 10,
  },
  videoCardPlayer: {
    flex: 1,
    borderRadius: 19,
    overflow: 'hidden',
    backgroundColor: '#ede9fe',
  },
  videoCaption: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '700',
    textAlign: 'center',
  },
  videoSkipButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    backgroundColor: '#ffffff',
    shadowColor: '#4c1d95',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: {width: 0, height: 4},
    elevation: 6,
  },
  videoSkipButtonText: {fontSize: 16, color: '#7c3aed', fontWeight: '800'},
});
