/**
 * Zumi's animated face.
 *
 * Production note: the branded Rive character (`zumi_character.riv`, state
 * machine `ZumiStates`) is a content/art deliverable that isn't in the bundle
 * yet. Rendering a Rive view with a missing resource can hard-crash on
 * Android, so Rive is gated behind `ZUMI_RIVE_ENABLED` (default OFF) and we
 * ship a friendly emoji avatar that reacts to the same states. When the artist
 * delivers the .riv asset to `android/app/src/main/assets/`, drop it in, flip
 * the flag, and the Rive branch takes over -- no other code changes.
 */

import React, {useEffect, useRef} from 'react';
import {Animated, Easing, StyleSheet, Text, View} from 'react-native';

import type {AvatarState} from '../../../services/zumi/zumiSessionManager';

/** Flip to true once `zumi_character.riv` ships in the Android assets folder. */
export const ZUMI_RIVE_ENABLED = false;

const FACE: Record<AvatarState, string> = {
  idle: '🙂',
  talking: '😄',
  listening: '👂',
  thinking: '🤔',
  celebrating: '🥳',
  encouraging: '🤗',
  story_mode: '😊',
};

export function ZumiAvatar({state}: {state: AvatarState}) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // A gentle "breathing" loop; a quicker bounce while celebrating.
    const toValue = state === 'celebrating' ? 1.12 : 1.06;
    const duration = state === 'celebrating' ? 380 : 1100;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue,
          duration,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, state]);

  if (ZUMI_RIVE_ENABLED) {
    // Lazily required so a missing native dep can't break the emoji path.
    // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
    const Rive = require('rive-react-native').default as React.ComponentType<{
      resourceName: string;
      stateMachineName: string;
      style?: object;
      autoplay?: boolean;
    }>;
    return (
      <View style={styles.wrap}>
        <Rive
          resourceName="zumi_character"
          stateMachineName="ZumiStates"
          style={styles.rive}
          autoplay
        />
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.bubble, {transform: [{scale: pulse}]}]}>
        <Text style={styles.face}>{FACE[state] ?? FACE.idle}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {alignItems: 'center', justifyContent: 'center'},
  rive: {width: 220, height: 220},
  bubble: {
    width: 168,
    height: 168,
    borderRadius: 84,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7c3aed',
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: {width: 0, height: 8},
    elevation: 12,
  },
  face: {fontSize: 86},
});
