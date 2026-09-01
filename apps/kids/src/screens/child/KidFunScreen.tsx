import React, {useCallback, useEffect, useRef, useState} from 'react';
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
import {useAuthStore} from '../../state/authStore';
import {
  configureSpeech,
  ensureMicPermission,
  listen,
  speak,
  stopSpeaking,
} from '../../services/zumi/zumiSpeech';

type Props = NativeStackScreenProps<JuniorStackParamList, 'KidFun'>;

interface ZumiPose {
  key: string;
  line: string;
  image: any;
}

const ZUMI_POSES: ZumiPose[] = [
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
  const userDoc = useAuthStore(s => s.userDoc);
  const coins = (userDoc as any)?.coins ?? 240;

  const [poseIndex, setPoseIndex] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [spokenReaction, setSpokenReaction] = useState<string | null>(null);

  // Animations
  const hopAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim2 = useRef(new Animated.Value(0)).current;
  const captionAnim = useRef(new Animated.Value(1)).current;

  // Initialize Speech engine once on mount
  useEffect(() => {
    void configureSpeech();
    return () => {
      stopSpeaking();
    };
  }, []);

  // Trigger Zumi hop/bounce animation (matching @keyframes jr-act 620ms cubic-bezier(.2,.8,.2,1))
  const triggerHop = useCallback(() => {
    hopAnim.setValue(0);
    Animated.sequence([
      Animated.timing(hopAnim, {
        toValue: 0.55,
        duration: 340,
        easing: Easing.bezier(0.2, 0.8, 0.2, 1),
        useNativeDriver: true,
      }),
      Animated.timing(hopAnim, {
        toValue: 1,
        duration: 280,
        easing: Easing.bezier(0.2, 0.8, 0.2, 1),
        useNativeDriver: true,
      }),
    ]).start();

    captionAnim.setValue(0.7);
    Animated.timing(captionAnim, {
      toValue: 1,
      duration: 300,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [hopAnim, captionAnim]);

  // Auto-cycle through Zumi poses every 3.2s when idle/not listening
  useEffect(() => {
    if (isListening) return;

    const timer = setInterval(() => {
      setPoseIndex(prev => (prev + 1) % ZUMI_POSES.length);
      triggerHop();
    }, 3200);

    return () => clearInterval(timer);
  }, [isListening, triggerHop]);

  // Pulsing animation for the mic ring when listening
  useEffect(() => {
    if (isListening) {
      const loop1 = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1200,
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

      const loop2 = Animated.loop(
        Animated.sequence([
          Animated.delay(400),
          Animated.timing(pulseAnim2, {
            toValue: 1,
            duration: 1200,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim2, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      );

      loop1.start();
      loop2.start();
      return () => {
        loop1.stop();
        loop2.stop();
      };
    } else {
      pulseAnim.setValue(0);
      pulseAnim2.setValue(0);
    }
  }, [isListening, pulseAnim, pulseAnim2]);

  // Tap Zumi: advance pose, bounce, and optionally speak line
  const tapZumi = () => {
    stopSpeaking();
    setIsListening(false);
    setSpokenReaction(null);
    setPoseIndex(prev => {
      const next = (prev + 1) % ZUMI_POSES.length;
      const nextLine = ZUMI_POSES[next].line.replace('Aalya', childName || 'Aalya');
      void speak(nextLine);
      return next;
    });
    triggerHop();
  };

  // Tap Mic: toggle listening mode & capture speech
  const tapMic = async () => {
    if (isListening) {
      setIsListening(false);
      stopSpeaking();
      return;
    }

    const granted = await ensureMicPermission();
    if (!granted) {
      return;
    }

    setIsListening(true);
    setSpokenReaction(null);
    triggerHop();

    // Prompt listening speech
    void speak('Bolo... main sun raha hoon!');

    try {
      const result = await listen({maxMs: 6000});
      if (result.status === 'ok' && result.transcript.trim()) {
        // Child spoke! Respond with enthusiasm and celebratory pose
        setIsListening(false);
        const happyPoses = [1, 2, 5, 6]; // excited, laughing, surprised, dancing
        const randomHappy = happyPoses[Math.floor(Math.random() * happyPoses.length)];
        setPoseIndex(randomHappy);
        triggerHop();

        const reaction = `Wah! Maine suna: "${result.transcript}"`;
        setSpokenReaction(reaction);
        void speak(reaction);
      } else {
        setIsListening(false);
      }
    } catch {
      setIsListening(false);
    }
  };

  const currentPose = ZUMI_POSES[poseIndex];
  const zumiImage = isListening ? ZUMI_LISTENING : currentPose.image;
  const zumiCaption = isListening
    ? 'Bolo... main sun raha hoon!'
    : spokenReaction || currentPose.line.replace('Aalya', childName || 'Aalya');

  // Mic ring pulse interpolations
  const ringScale1 = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.45],
  });
  const ringOpacity1 = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.75, 0],
  });

  const ringScale2 = pulseAnim2.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.6],
  });
  const ringOpacity2 = pulseAnim2.interpolate({
    inputRange: [0, 1],
    outputRange: [0.6, 0],
  });

  // Zumi hop animation interpolations
  const zumiTranslateY = hopAnim.interpolate({
    inputRange: [0, 0.55, 1],
    outputRange: [12, -10, 0],
  });
  const zumiScale = hopAnim.interpolate({
    inputRange: [0, 0.55, 1],
    outputRange: [0.94, 1.04, 1],
  });

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* 180deg Linear Gradient: #602EDB 0%, #602EDB 46%, #F0447F 100% */}
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

      {/* Animated Sparkles matching design doc canvas */}
      <SparkleStar top={120} right={34} size={11} delay={0} />
      <SparkleStar top={210} left={30} size={13} delay={500} />
      <SparkleStar top={290} right={56} size={10} delay={1000} />
      <SparkleStar top={340} left={60} size={9} delay={1400} />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        {/* Top Navigation Bar */}
        <View style={styles.topBar}>
          <Pressable
            style={styles.backBtn}
            onPress={() => {
              stopSpeaking();
              navigation.goBack();
            }}
            android_ripple={{color: 'rgba(255,255,255,0.25)', borderless: true, radius: 23}}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M15 5l-7 7 7 7" />
            </Svg>
          </Pressable>

          <View style={{flex: 1}} />

          {/* Coin Badge Pill */}
          <View style={styles.coinBadge}>
            <View style={styles.coinIcon}>
              <Text style={styles.coinSym}>₹</Text>
            </View>
            <Text style={styles.coinText}>{coins}</Text>
          </View>
        </View>

        {/* Zumi Interactive Stage */}
        <View style={styles.stage}>
          <Pressable onPress={tapZumi} style={styles.zumiPressable}>
            <Animated.View
              style={[
                styles.zumiWrap,
                {
                  transform: [{translateY: zumiTranslateY}, {scale: zumiScale}],
                },
              ]}>
              <Image
                source={zumiImage}
                style={styles.zumiBody}
                resizeMode="contain"
              />
            </Animated.View>
          </Pressable>
        </View>

        {/* Caption & Mic Section */}
        <View style={styles.bottomSection}>
          <Animated.Text
            style={[
              styles.caption,
              {
                opacity: captionAnim,
                transform: [{scale: captionAnim}],
              },
            ]}>
            {zumiCaption}
          </Animated.Text>

          <View style={styles.micWrapper}>
            {/* Outer Static / Semi-transparent Ring */}
            <View
              style={[
                styles.micRing,
                {borderColor: isListening ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.42)'},
              ]}
            />

            {/* Pulsing Animated Radar Rings when listening */}
            {isListening && (
              <>
                <Animated.View
                  style={[
                    styles.micRingPulse,
                    {
                      transform: [{scale: ringScale1}],
                      opacity: ringOpacity1,
                    },
                  ]}
                />
                <Animated.View
                  style={[
                    styles.micRingPulse,
                    {
                      transform: [{scale: ringScale2}],
                      opacity: ringOpacity2,
                    },
                  ]}
                />
              </>
            )}

            {/* Main Mic Button */}
            <Pressable
              style={({pressed}) => [
                styles.micBtn,
                {backgroundColor: isListening ? '#F0447F' : '#FFFFFF'},
                pressed && styles.micBtnPressed,
              ]}
              onPress={tapMic}
              android_ripple={{color: 'rgba(0,0,0,0.12)', borderless: true, radius: 42}}>
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

/** Animated Star Sparkle matching HTML @keyframes jr-sparkle */
function SparkleStar({
  top,
  left,
  right,
  size,
  delay = 0,
}: {
  top: number;
  left?: number;
  right?: number;
  size: number;
  delay?: number;
}) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim, delay]);

  const scale = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 1.2],
  });
  const opacity = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 1],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.sparkleContainer,
        {
          top,
          left,
          right,
          width: size,
          height: size,
          opacity,
          transform: [{scale}],
        },
      ]}>
      <Svg width="100%" height="100%" viewBox="0 0 24 24" fill="#FFD84D">
        <Path d="M12 0L14.64 9.36L24 12L14.64 14.64L12 24L9.36 14.64L0 12L9.36 9.36L12 0Z" />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#602EDB',
  },
  safe: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
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
    fontWeight: '800',
    color: junior.yellowCoinText,
    top: 1,
  },
  coinText: {
    fontFamily: fonts.headingExtraBold,
    fontSize: 20,
    fontWeight: '800',
    color: junior.purplePillText,
    top: 1,
  },
  stage: {
    flex: 1,
    minHeight: 0,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 22,
  },
  zumiPressable: {
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  zumiWrap: {
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  zumiBody: {
    width: 340,
    height: 390,
    maxWidth: '100%',
    shadowColor: 'rgba(20,10,60,0.38)',
    shadowOffset: {width: 0, height: 16},
    shadowOpacity: 0.8,
    shadowRadius: 22,
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
    fontWeight: '800',
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
    backgroundColor: 'rgba(240,68,127,0.4)',
  },
  micBtn: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.cta,
  },
  micBtnPressed: {
    transform: [{scale: 0.95}],
  },
  sparkleContainer: {
    position: 'absolute',
    zIndex: 1,
  },
});
