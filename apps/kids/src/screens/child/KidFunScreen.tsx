import React, {useEffect, useRef, useState} from 'react';
import {
  Animated,
  Easing,
  Image,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Svg, {Defs, LinearGradient, Path, Rect, Stop} from 'react-native-svg';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {JuniorStackParamList} from '../../navigation/types';
import {fonts, junior, neutral, radius, shadows, spacing} from '../../theme';
import {useChildProfile} from '../../context/ChildProfileContext';

type Props = NativeStackScreenProps<JuniorStackParamList, 'KidFun'>;

const ZUMI_POSES = [
  {key: 'greeting', line: 'Hi Aalya! Kaise ho?', image: require('../../assets/zumi-greeting.png')},
  {key: 'excited', line: 'Wah! Bahut badhiya!', image: require('../../assets/zumi-excited.png')},
  {key: 'laughing', line: 'Hahaha! Ye toh mazedaar tha!', image: require('../../assets/zumi-laughing.png')},
  {key: 'thinking', line: 'Hmm... socho, jawab kya hoga?', image: require('../../assets/zumi-thinking.png')},
  {key: 'clapping', line: 'Shabaash! Taali bajao!', image: require('../../assets/zumi-clapping.png')},
  {key: 'surprised', line: 'Arre wah! Sach me?', image: require('../../assets/zumi-surprised.png')},
  {key: 'dancing', line: 'Chalo naachein! La la la...', image: require('../../assets/zumi-dancing.png')},
  {key: 'byebye', line: 'Bye bye! Phir milenge!', image: require('../../assets/zumi-byebye.png')},
];

const ZUMI_LISTENING = require('../../assets/zumi-listening.png');

export function KidFunScreen({navigation}: Props) {
  const {childName} = useChildProfile();
  const [poseIndex, setPoseIndex] = useState(0);
  const [isListening, setIsListening] = useState(false);

  const pulseAnim = useRef(new Animated.Value(0)).current;

  // Auto-cycle through Zumi poses every 3.2s when not listening
  useEffect(() => {
    if (isListening) return;

    const timer = setInterval(() => {
      setPoseIndex(prev => (prev + 1) % ZUMI_POSES.length);
    }, 3200);

    return () => clearInterval(timer);
  }, [isListening]);

  // Pulse animation for the mic ring when listening
  useEffect(() => {
    if (isListening) {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1100,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      );
      anim.start();
      return () => anim.stop();
    } else {
      pulseAnim.setValue(0);
    }
  }, [isListening, pulseAnim]);

  const tapZumi = () => {
    setPoseIndex(prev => (prev + 1) % ZUMI_POSES.length);
    setIsListening(false);
  };

  const tapMic = () => {
    navigation.navigate('ZumiHome');
  };

  const currentPose = ZUMI_POSES[poseIndex];
  const zumiImage = isListening ? ZUMI_LISTENING : currentPose.image;
  const zumiCaption = isListening
    ? 'Bolo... main sun raha hoon!'
    : currentPose.line.replace('Aalya', childName || 'Aalya');

  const ringScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.35],
  });
  const ringOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.85, 0],
  });

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      {/* 180deg Gradient Background: #602EDB 0%, #602EDB 46%, #F0447F 100% */}
      <Svg style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="funBg" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#602EDB" />
            <Stop offset="0.46" stopColor="#602EDB" />
            <Stop offset="1" stopColor="#F0447F" />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#funBg)" />
      </Svg>

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        {/* Top Bar */}
        <View style={styles.topBar}>
          <Pressable
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            android_ripple={{color: 'rgba(255,255,255,0.2)', borderless: true, radius: 23}}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M15 5l-7 7 7 7" />
            </Svg>
          </Pressable>

          <View style={{flex: 1}} />

          <View style={styles.coinBadge}>
            <View style={styles.coinIcon}>
              <Text style={styles.coinSym}>₹</Text>
            </View>
            <Text style={styles.coinText}>240</Text>
          </View>
        </View>

        {/* Zumi Stage */}
        <View style={styles.stage}>
          <Pressable onPress={tapZumi}>
            <Image
              source={zumiImage}
              style={styles.zumiBody}
              resizeMode="contain"
            />
          </Pressable>
        </View>

        {/* Caption & Mic Section */}
        <View style={styles.bottomSection}>
          <Text style={styles.caption}>{zumiCaption}</Text>

          <View style={styles.micWrapper}>
            {/* Outer Ring */}
            <View
              style={[
                styles.micRing,
                {borderColor: isListening ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.42)'},
              ]}
            />

            {/* Pulsing Animated Ring when listening */}
            {isListening && (
              <Animated.View
                style={[
                  styles.micRingPulse,
                  {
                    transform: [{scale: ringScale}],
                    opacity: ringOpacity,
                  },
                ]}
              />
            )}

            {/* Mic Button */}
            <Pressable
              style={[
                styles.micBtn,
                {backgroundColor: isListening ? '#F0447F' : '#FFFFFF'},
              ]}
              onPress={tapMic}
              android_ripple={{color: 'rgba(0,0,0,0.1)', borderless: true, radius: 42}}>
              <Svg
                width={38}
                height={38}
                viewBox="0 0 24 24"
                fill="none"
                stroke={isListening ? '#FFFFFF' : '#F0447F'}
                strokeWidth={2.2}
                strokeLinecap="round"
                strokeLinejoin="round">
                <Rect x={9} y={3} width={6} height={11} rx={3} />
                <Path d="M5 12a7 7 0 0 0 14 0M12 19v3" />
              </Svg>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: junior.bgHome,
  },
  safe: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md12,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  backBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coinBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    height: 46,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: neutral.surface,
  },
  coinIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: junior.yellowCoinBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coinSym: {
    fontFamily: fonts.headingExtraBold,
    fontSize: 13,
    color: junior.yellowCoinText,
    top: 1,
  },
  coinText: {
    fontFamily: fonts.headingExtraBold,
    fontSize: 20,
    color: junior.purplePillText,
    top: 1,
  },
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 22,
  },
  zumiBody: {
    width: 340,
    height: 390,
  },
  bottomSection: {
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: 22,
  },
  caption: {
    minHeight: 52,
    fontFamily: fonts.headingExtraBold,
    fontSize: 24,
    lineHeight: 28,
    color: neutral.surface,
    textAlign: 'center',
    textShadowColor: 'rgba(60,10,60,0.5)',
    textShadowOffset: {width: 0, height: 2},
    textShadowRadius: 10,
  },
  micWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    width: 110,
    height: 110,
  },
  micRing: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 3,
  },
  micRingPulse: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: junior.pinkHeaderStart,
  },
  micBtn: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.cta,
  },
});
