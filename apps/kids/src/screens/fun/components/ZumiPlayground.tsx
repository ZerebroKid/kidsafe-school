/**
 * ZumiPlayground -- the live, touch-interactive stage that wraps Zumi the
 * mascot so the session feels like a game, not a video:
 *
 *   - Tap anywhere on the stage -> a sparkle/emoji bursts at the finger and
 *     Zumi gives a happy little bounce.
 *   - Floating emoji "bubbles" can be grabbed and flung; they springily settle
 *     back home so nothing ever drifts off-screen.
 *
 * Built on react-native-gesture-handler + react-native-reanimated (the UI-thread
 * animations stay smooth even while audio/STT work happens on the JS thread).
 * It renders ON TOP of the scene cue (Lottie/Rive) but only fills the character
 * zone, so the speech bubble and mic controls below stay fully tappable.
 */

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {StyleSheet, Text} from 'react-native';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import type {AvatarState} from '../../../services/zumi/zumiSessionManager';
import {ZumiCharacter} from './ZumiCharacter';

// reanimated's Animated.View type isn't a clean JSX element type under our
// @types/react (duplicate-React-types issue, same as the Lottie/Rive wrappers).
// Cast to a permissive shape so it composes while keeping animated styles.
const AView = Animated.View as unknown as React.ComponentType<{
  style?: unknown;
  pointerEvents?: 'none' | 'auto' | 'box-none' | 'box-only';
  children?: React.ReactNode;
}>;

/** Emoji that burst out when the child taps the stage. */
const SPARKLES = ['✨', '🌟', '💫', '⭐', '🎈', '💖', '🫧', '🌈'];
/** Draggable ambient toys floating around Zumi. */
const TOYS = [
  {emoji: '🪐', left: '6%', top: '8%'},
  {emoji: '🚀', left: '78%', top: '12%'},
  {emoji: '🦋', left: '10%', top: '64%'},
  {emoji: '🐠', left: '80%', top: '60%'},
] as const;

interface Particle {
  id: number;
  x: number;
  y: number;
  emoji: string;
}

export function ZumiPlayground({
  state,
  videoActive = false,
}: {
  state: AvatarState;
  videoActive?: boolean;
}) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const nextId = useRef(0);
  const bounce = useSharedValue(1);
  // 0 = normal centered pose, 1 = shrunk + lifted so Zumi "sits above" the
  // explanation video. Springs both ways for a smooth up/down transition.
  const lift = useSharedValue(0);

  useEffect(() => {
    lift.value = withSpring(videoActive ? 1 : 0, {damping: 14, stiffness: 120});
  }, [videoActive, lift]);

  const spawn = useCallback((x: number, y: number) => {
    const id = nextId.current++;
    const emoji = SPARKLES[Math.floor(Math.random() * SPARKLES.length)];
    // Cap how many particles live at once so rapid tapping stays cheap.
    setParticles(prev => [...prev.slice(-14), {id, x, y, emoji}]);
  }, []);

  const remove = useCallback((id: number) => {
    setParticles(prev => prev.filter(p => p.id !== id));
  }, []);

  const tap = Gesture.Tap()
    .maxDuration(400)
    .onEnd((e, success) => {
      'worklet';
      if (!success) return;
      runOnJS(spawn)(e.x, e.y);
      bounce.value = withSequence(
        withSpring(1.12, {damping: 6, stiffness: 220}),
        withSpring(1, {damping: 8}),
      );
    });

  const avatarStyle = useAnimatedStyle(() => ({
    transform: [
      {translateY: lift.value * -44},
      {scale: bounce.value * (1 - lift.value * 0.42)},
    ],
  }));

  // Floating toys fade out during the video so they don't clutter/overlap it.
  const toysStyle = useAnimatedStyle(() => ({
    opacity: 1 - lift.value,
  }));

  return (
    <GestureDetector gesture={tap}>
      <AView style={styles.fill}>
        <AView style={[styles.center, avatarStyle]}>
          <ZumiCharacter state={state} />
        </AView>

        <AView
          style={[styles.fill, toysStyle]}
          pointerEvents={videoActive ? 'none' : 'box-none'}>
          {TOYS.map((t, i) => (
            <DragToy key={i} emoji={t.emoji} left={t.left} top={t.top} />
          ))}
        </AView>

        {particles.map(p => (
          <SparkleParticle key={p.id} particle={p} onDone={remove} />
        ))}
      </AView>
    </GestureDetector>
  );
}

/** A grab-and-fling emoji that springs back to its home spot on release. */
function DragToy({
  emoji,
  left,
  top,
}: {
  emoji: string;
  left: string;
  top: string;
}) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const grabbed = useSharedValue(0);

  const pan = Gesture.Pan()
    .onStart(() => {
      'worklet';
      startX.value = tx.value;
      startY.value = ty.value;
      grabbed.value = withTiming(1, {duration: 120});
    })
    .onUpdate(e => {
      'worklet';
      tx.value = startX.value + e.translationX;
      ty.value = startY.value + e.translationY;
    })
    .onEnd(() => {
      'worklet';
      tx.value = withSpring(0, {damping: 9, stiffness: 120});
      ty.value = withSpring(0, {damping: 9, stiffness: 120});
      grabbed.value = withTiming(0, {duration: 200});
    });

  const style = useAnimatedStyle(() => ({
    transform: [
      {translateX: tx.value},
      {translateY: ty.value},
      {scale: 1 + grabbed.value * 0.25},
    ],
  }));

  return (
    <GestureDetector gesture={pan}>
      <AView style={[styles.toy, {left, top} as object, style]}>
        <Text style={styles.toyText}>{emoji}</Text>
      </AView>
    </GestureDetector>
  );
}

function SparkleParticle({
  particle,
  onDone,
}: {
  particle: Particle;
  onDone: (id: number) => void;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(
      1,
      {duration: 1100, easing: Easing.out(Easing.quad)},
      finished => {
        'worklet';
        if (finished) runOnJS(onDone)(particle.id);
      },
    );
  }, [progress, onDone, particle.id]);

  const style = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
    transform: [
      {translateY: -80 * progress.value},
      {scale: 0.6 + progress.value * 0.9},
    ],
  }));

  return (
    <AView
      pointerEvents="none"
      style={[styles.particle, {left: particle.x - 16, top: particle.y - 16}, style]}>
      <Text style={styles.particleText}>{particle.emoji}</Text>
    </AView>
  );
}

const styles = StyleSheet.create({
  fill: {...StyleSheet.absoluteFillObject},
  center: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  toy: {position: 'absolute'},
  toyText: {fontSize: 34},
  particle: {position: 'absolute', width: 32, height: 32, alignItems: 'center'},
  particleText: {fontSize: 26},
});
