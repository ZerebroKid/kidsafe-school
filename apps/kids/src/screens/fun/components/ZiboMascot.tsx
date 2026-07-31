import React, {useEffect, useRef} from 'react';
import {Animated, Easing, StyleSheet, View} from 'react-native';

/** Native, lightweight version of the blue Zibo mascot approved for Junior. */
export function ZiboMascot({size = 150}: {size?: number}) {
  const bob = useRef(new Animated.Value(0)).current;
  const scale = size / 150;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, {toValue: -8, duration: 1300, easing: Easing.inOut(Easing.ease), useNativeDriver: true}),
        Animated.timing(bob, {toValue: 0, duration: 1300, easing: Easing.inOut(Easing.ease), useNativeDriver: true}),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [bob]);

  return (
    <Animated.View style={[styles.mascot, {transform: [{scale}, {translateY: bob}]}]}>
      <View style={styles.antennaStem} />
      <View style={styles.antennaLight} />
      <View style={styles.face}>
        <View style={[styles.eye, styles.leftEye]}><View style={styles.pupil} /></View>
        <View style={[styles.eye, styles.rightEye]}><View style={styles.pupil} /></View>
        <View style={[styles.cheek, styles.leftCheek]} />
        <View style={[styles.cheek, styles.rightCheek]} />
        <View style={styles.smile} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  mascot: {width: 150, height: 154, alignItems: 'center'},
  antennaStem: {position: 'absolute', top: 0, width: 7, height: 29, borderRadius: 6, backgroundColor: '#ffd54a'},
  antennaLight: {position: 'absolute', top: -13, width: 22, height: 22, borderRadius: 11, backgroundColor: '#ffd54a', shadowColor: '#ffd54a', shadowOpacity: 0.9, shadowRadius: 12, elevation: 6},
  face: {position: 'absolute', bottom: 0, width: 150, height: 138, borderRadius: 75, backgroundColor: '#45b8ef', shadowColor: '#38b6f2', shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: {width: 0, height: 10}, elevation: 6},
  eye: {position: 'absolute', top: 43, width: 35, height: 35, borderRadius: 18, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center'},
  leftEye: {left: 32},
  rightEye: {right: 32},
  pupil: {width: 16, height: 16, borderRadius: 8, backgroundColor: '#22243f'},
  cheek: {position: 'absolute', top: 85, width: 21, height: 12, borderRadius: 10, backgroundColor: '#ff9ec4', opacity: 0.85},
  leftCheek: {left: 25},
  rightCheek: {right: 25},
  smile: {position: 'absolute', top: 88, left: 57, width: 36, height: 20, borderBottomWidth: 5, borderColor: '#22243f', borderRadius: 24},
});
