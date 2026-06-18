/**
 * ZumiVoiceOrb -- a Siri-style animated voice orb.
 *
 * A glowing gradient core that "breathes", emits expanding rings, and shows an
 * equalizer waveform. The motion reacts to Zumi's `AvatarState` so the orb is
 * alive the instant Zumi starts preparing speech -- which makes the short cloud
 * TTS round-trip feel intentional instead of a dead pause.
 *
 * Built on the core `Animated` API (every animation runs on the native driver
 * via transform/opacity) + a static `react-native-svg` radial gradient for the
 * core. No reanimated worklets, so it's cheap and crash-safe.
 */

import React, {useEffect, useMemo, useRef} from 'react';
import {Animated, Easing, StyleSheet, View} from 'react-native';

import type {AvatarState} from '../../../services/zumi/zumiSessionManager';

type OrbMode = 'idle' | 'speaking' | 'listening' | 'thinking';

const ORB = 260;
const CORE = 150;
const BAR_COUNT = 5;

function toMode(state: AvatarState): OrbMode {
  switch (state) {
    case 'talking':
    case 'celebrating':
    case 'story_mode':
      return 'speaking';
    case 'listening':
      return 'listening';
    case 'thinking':
      return 'thinking';
    default:
      return 'idle';
  }
}

export function ZumiVoiceOrb({state}: {state: AvatarState}) {
  const mode = toMode(state);
  const active = mode === 'speaking' || mode === 'listening';

  const breathe = useRef(new Animated.Value(0)).current;
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const bars = useMemo(
    () => Array.from({length: BAR_COUNT}, () => new Animated.Value(0.25)),
    [],
  );

  // Core breathing -- always on, quicker while active.
  useEffect(() => {
    const duration = active ? 900 : 2200;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, {
          toValue: 1,
          duration,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(breathe, {
          toValue: 0,
          duration,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, breathe]);

  // Expanding rings -- only while speaking/listening.
  useEffect(() => {
    if (!active) {
      ring1.setValue(0);
      ring2.setValue(0);
      return;
    }
    const makeRing = (val: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, {
            toValue: 1,
            duration: 1900,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(val, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      );
    const a = makeRing(ring1, 0);
    const b = makeRing(ring2, 950);
    a.start();
    b.start();
    return () => {
      a.stop();
      b.stop();
    };
  }, [active, ring1, ring2]);

  // Equalizer waveform -- intensity depends on mode.
  useEffect(() => {
    const loops = bars.map((bar, i) => {
      let low = 0.18;
      let high = 0.32;
      let base = 360;
      if (mode === 'speaking') {
        low = 0.3;
        high = 1;
        base = 280;
      } else if (mode === 'listening') {
        low = 0.25;
        high = 0.7;
        base = 360;
      } else if (mode === 'thinking') {
        low = 0.2;
        high = 0.45;
        base = 520;
      }
      // Per-bar variation so it never looks mechanical.
      const dur = base + i * 70 + (i % 2 === 0 ? 60 : 0);
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(bar, {
            toValue: high,
            duration: dur,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(bar, {
            toValue: low,
            duration: dur,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
      return loop;
    });
    return () => loops.forEach(l => l.stop());
  }, [bars, mode]);

  const coreScale = breathe.interpolate({
    inputRange: [0, 1],
    outputRange: active ? [0.94, 1.06] : [0.97, 1.03],
  });

  return (
    <View style={styles.wrap}>
      <Ring progress={ring1} />
      <Ring progress={ring2} />

      <Animated.View
        style={[styles.coreWrap, {transform: [{scale: coreScale}]}]}>
        {/* Layered translucent circles fake a soft radial gradient sphere
            (indigo base, pink underglow, violet + light highlights) without a
            gradient dependency. */}
        <View style={styles.coreBase}>
          <View style={styles.tintPink} />
          <View style={styles.highlightViolet} />
          <View style={styles.highlightLight} />

          <View style={styles.waveRow} pointerEvents="none">
            {bars.map((bar, i) => (
              <Animated.View
                key={i}
                style={[styles.bar, {transform: [{scaleY: bar}]}]}
              />
            ))}
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

function Ring({progress}: {progress: Animated.Value}) {
  const scale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.62, 1.32],
  });
  const opacity = progress.interpolate({
    inputRange: [0, 0.15, 1],
    outputRange: [0, 0.45, 0],
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.ring, {opacity, transform: [{scale}]}]}
    />
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: ORB,
    height: ORB,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coreWrap: {
    width: CORE,
    height: CORE,
    alignItems: 'center',
    justifyContent: 'center',
    // Soft glow under the orb.
    shadowColor: '#8b5cf6',
    shadowOpacity: 0.45,
    shadowRadius: 28,
    shadowOffset: {width: 0, height: 10},
    elevation: 14,
  },
  coreBase: {
    width: CORE,
    height: CORE,
    borderRadius: CORE / 2,
    backgroundColor: '#6366f1',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tintPink: {
    position: 'absolute',
    width: CORE * 0.9,
    height: CORE * 0.9,
    borderRadius: CORE,
    backgroundColor: '#ec4899',
    opacity: 0.55,
    bottom: -CORE * 0.28,
    right: -CORE * 0.1,
  },
  highlightViolet: {
    position: 'absolute',
    width: CORE * 0.8,
    height: CORE * 0.8,
    borderRadius: CORE,
    backgroundColor: '#a78bfa',
    opacity: 0.85,
    top: CORE * 0.06,
    left: CORE * 0.08,
  },
  highlightLight: {
    position: 'absolute',
    width: CORE * 0.46,
    height: CORE * 0.46,
    borderRadius: CORE,
    backgroundColor: '#e9d5ff',
    opacity: 0.9,
    top: CORE * 0.14,
    left: CORE * 0.16,
  },
  ring: {
    position: 'absolute',
    width: CORE,
    height: CORE,
    borderRadius: CORE / 2,
    borderWidth: 2,
    borderColor: '#8b5cf6',
  },
  waveRow: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  bar: {
    width: 7,
    height: 54,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
});
