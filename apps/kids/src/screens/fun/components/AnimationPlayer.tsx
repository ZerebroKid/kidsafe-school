/**
 * Plays a Lottie animation from EITHER a bundled local JSON (`source`, a
 * `require(...)`d object) or a Firebase Storage URL (`url`, fetched at runtime).
 * Renders nothing until something is ready and nothing at all if both are
 * missing or the remote fetch fails -- the story stays fully functional without
 * animations.
 */

import React, {useEffect, useState} from 'react';
import {StyleSheet, View, type StyleProp, type ViewStyle} from 'react-native';
import LottieViewRaw from 'lottie-react-native';

// lottie-react-native@7's exported class-component type isn't a clean JSX
// element type under our @types/react; cast to a function component shape.
const LottieView = LottieViewRaw as unknown as React.ComponentType<{
  source: object;
  autoPlay?: boolean;
  loop?: boolean;
  style?: object;
}>;

interface AnimationPlayerProps {
  /** Remote Lottie JSON URL (optional). */
  url?: string | null;
  /** Bundled Lottie JSON object from `require('...json')` (optional, preferred). */
  source?: object | null;
  loop?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function AnimationPlayer({
  url,
  source,
  loop = true,
  style,
}: AnimationPlayerProps) {
  const [remote, setRemote] = useState<object | null>(null);

  useEffect(() => {
    let cancelled = false;
    setRemote(null);
    if (!url) return;
    fetch(url)
      .then(r => r.json())
      .then(json => {
        if (!cancelled) setRemote(json);
      })
      .catch(() => {
        if (!cancelled) setRemote(null);
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  const resolved = source ?? remote;
  if (!resolved) return null;
  return (
    <View style={[styles.wrap, style]} pointerEvents="none">
      <LottieView source={resolved} autoPlay loop={loop} style={styles.lottie} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {alignItems: 'center', justifyContent: 'center'},
  lottie: {width: '100%', height: '100%'},
});
