/**
 * Zumi's cartoon mascot -- the animated character the child sees through the
 * whole voice session (replaces the abstract orb). It is driven entirely by the
 * session's `AvatarState`:
 *
 *   - talking      -> mouth-open / mouth-closed frame swap (cheap lip-sync) +
 *                     gentle breathing bob
 *   - listening    -> a pulsing "I'm listening" ring + soft scale pulse
 *   - thinking      -> head tilt wobble + thought dots
 *   - celebrating  -> jump loop with the celebrate frame
 *   - idle / story_mode / encouraging -> calm breathing bob
 *
 * All motion uses the native driver. Only three art frames are needed
 * (idle / talk / celebrate); the rest are expressed with motion + overlays so
 * the character feels alive without a frame for every mood.
 */

import React, {useEffect, useRef, useState} from 'react';
import {Animated, Easing, StyleSheet, Text, View} from 'react-native';

import type {AvatarState} from '../../../services/zumi/zumiSessionManager';
import {colors} from '../../../theme';

const IDLE = require('../../../assets/zumi/zumi_idle.png');
const TALK = require('../../../assets/zumi/zumi_talk.png');
const CELEBRATE = require('../../../assets/zumi/zumi_celebrate.png');

/** Zumi's signature purple (matches the character art + screen accent). */
const ZUMI_ACCENT = '#8b5cf6';
/** Mouth frame toggle interval while speaking (ms). */
const LIPSYNC_MS = 170;

const AnimatedImage = Animated.Image;

export function ZumiCharacter({state}: {state: AvatarState}) {
  const bob = useRef(new Animated.Value(0)).current;
  const tilt = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const [mouthOpen, setMouthOpen] = useState(false);

  // Lip-sync: alternate mouth frames only while Zumi is talking.
  useEffect(() => {
    if (state !== 'talking') {
      setMouthOpen(false);
      return;
    }
    const id = setInterval(() => setMouthOpen(o => !o), LIPSYNC_MS);
    return () => clearInterval(id);
  }, [state]);

  // Body motion per state.
  useEffect(() => {
    bob.stopAnimation();
    tilt.stopAnimation();
    scale.stopAnimation();
    bob.setValue(0);
    tilt.setValue(0);
    scale.setValue(1);

    const breathe = () =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(bob, {
            toValue: -6,
            duration: 1300,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(bob, {
            toValue: 0,
            duration: 1300,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );

    let anim: Animated.CompositeAnimation;
    if (state === 'celebrating') {
      anim = Animated.loop(
        Animated.sequence([
          Animated.timing(bob, {
            toValue: -20,
            duration: 300,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(bob, {
            toValue: 0,
            duration: 300,
            easing: Easing.bounce,
            useNativeDriver: true,
          }),
        ]),
      );
    } else if (state === 'listening') {
      anim = Animated.loop(
        Animated.sequence([
          Animated.timing(scale, {
            toValue: 1.05,
            duration: 700,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 1,
            duration: 700,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );
    } else if (state === 'thinking') {
      anim = Animated.loop(
        Animated.sequence([
          Animated.timing(tilt, {
            toValue: 1,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(tilt, {
            toValue: -1,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );
    } else {
      anim = breathe();
    }
    anim.start();
    return () => anim.stop();
  }, [state, bob, tilt, scale]);

  const rotate = tilt.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-7deg', '7deg'],
  });

  const source =
    state === 'celebrating'
      ? CELEBRATE
      : state === 'talking' && mouthOpen
        ? TALK
        : IDLE;

  return (
    <View style={styles.wrap}>
      {state === 'listening' ? <ListeningRing /> : null}
      <View style={styles.imgClip}>
        <AnimatedImage
          source={source}
          resizeMode="contain"
          style={[
            styles.img,
            {transform: [{translateY: bob}, {scale}, {rotate}]},
          ]}
        />
      </View>
      {state === 'thinking' ? <ThinkingDots /> : null}
    </View>
  );
}

/** Soft expanding ring behind the character while listening. */
function ListeningRing() {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 1500,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    );
    anim.start();
    return () => anim.stop();
  }, [pulse]);
  const scale = pulse.interpolate({inputRange: [0, 1], outputRange: [0.7, 1.4]});
  const opacity = pulse.interpolate({inputRange: [0, 1], outputRange: [0.45, 0]});
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.ring, {opacity, transform: [{scale}]}]}
    />
  );
}

/** Three bouncing dots above the head while thinking. */
function ThinkingDots() {
  return (
    <View style={styles.dotsBubble} pointerEvents="none">
      <Dot delay={0} />
      <Dot delay={160} />
      <Dot delay={320} />
    </View>
  );
}

function Dot({delay}: {delay: number}) {
  const y = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(y, {
          toValue: -5,
          duration: 300,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(y, {
          toValue: 0,
          duration: 300,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.delay(300),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [y, delay]);
  return <Animated.View style={[styles.dot, {transform: [{translateY: y}]}]} />;
}

const styles = StyleSheet.create({
  wrap: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imgClip: {
    width: 190,
    height: 190,
    borderRadius: 95,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  img: {
    width: 190,
    height: 190,
  },
  ring: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: ZUMI_ACCENT,
  },
  dotsBubble: {
    position: 'absolute',
    top: 4,
    right: 10,
    flexDirection: 'row',
    gap: 6,
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: ZUMI_ACCENT,
  },
});
