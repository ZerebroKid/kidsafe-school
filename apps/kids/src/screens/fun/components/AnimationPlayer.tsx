/**
 * Plays a topic Lottie animation fetched from a Firebase Storage URL. Renders
 * nothing until the JSON loads, and nothing at all if the URL is missing or
 * fails to load -- the story stays fully functional without animations.
 */

import React, {useEffect, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import LottieViewRaw from 'lottie-react-native';

// lottie-react-native@7's exported class-component type isn't a clean JSX
// element type under our @types/react; cast to a function component shape.
const LottieView = LottieViewRaw as unknown as React.ComponentType<{
  source: object;
  autoPlay?: boolean;
  loop?: boolean;
  style?: object;
}>;

export function AnimationPlayer({url}: {url: string | null}) {
  const [source, setSource] = useState<object | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSource(null);
    if (!url) return;
    fetch(url)
      .then(r => r.json())
      .then(json => {
        if (!cancelled) setSource(json);
      })
      .catch(() => {
        if (!cancelled) setSource(null);
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (!source) return null;
  return (
    <View style={styles.wrap} pointerEvents="none">
      <LottieView source={source} autoPlay loop style={styles.lottie} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {alignItems: 'center', justifyContent: 'center'},
  lottie: {width: 260, height: 220},
});
