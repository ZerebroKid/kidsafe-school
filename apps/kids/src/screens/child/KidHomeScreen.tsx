/**
 * KidHomeScreen -- the fun-mode (grade <= 6) Home tab.
 *
 * Replaces the parental StatusScreen for young kids with the playful purple
 * dashboard from the design: coin + heart pills up top, Zumi the mascot with a
 * breathing bob, a speech-bubble greeting, and a 2x2 grid of action cards
 * (Fun / Cartoons / Reels / Games). Grade 7+ children still get StatusScreen
 * (see MainTabNavigator).
 *
 * Coins and hearts are STATIC placeholders for now -- the real economy comes
 * later. Cartoons and Games are card-only: tapping gives a playful bounce and
 * a "coming soon" toast instead of navigating.
 */

import React, {useRef} from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  ToastAndroid,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Svg, {Defs, LinearGradient, Rect, Stop} from 'react-native-svg';
import type {BottomTabScreenProps} from '@react-navigation/bottom-tabs';

import {useChildProfile} from '../../context/ChildProfileContext';
import {spacing} from '../../theme';
import type {MainTabParamList} from '../../navigation/types';

const ZUMI_IDLE = require('../../assets/zumi/zumi_idle.png');

// Placeholder economy values -- wire to Firestore later.
const COINS = 240;
const HEARTS = '3/10';

type Props = BottomTabScreenProps<MainTabParamList, 'HomeTab'>;

export function KidHomeScreen({navigation}: Props) {
  const {childName} = useChildProfile();
  const greeting = `Hi ${childName || 'dost'}! Kaise ho? 🎉`;

  return (
    <View style={styles.root}>
      <Svg style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="homeBg" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#7c3aed" />
            <Stop offset="0.55" stopColor="#8b5cf6" />
            <Stop offset="1" stopColor="#a855f7" />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#homeBg)" />
      </Svg>
      <Sparkle style={{top: '12%', left: '8%'}} char="✦" />
      <Sparkle style={{top: '9%', right: '10%'}} char="＋" />
      <Sparkle style={{top: '30%', left: '5%'}} char="＋" />
      <Sparkle style={{top: '27%', right: '6%'}} char="✦" />

      <SafeAreaView style={styles.safe}>
        <View style={styles.pillRow}>
          <View style={styles.pill}>
            <Text style={styles.pillIcon}>🪙</Text>
            <Text style={styles.pillText}>{COINS}</Text>
          </View>
          <View style={styles.pill}>
            <Text style={styles.pillIcon}>💜</Text>
            <Text style={styles.pillText}>{HEARTS}</Text>
          </View>
        </View>

        <BreathingZumi />

        <View style={styles.bubble}>
          <Text style={styles.bubbleText}>{greeting}</Text>
        </View>

        <View style={styles.grid}>
          <View style={styles.gridRow}>
            <HomeCard
              color="#f59e0b"
              icon="🤖"
              title="Fun"
              subtitle="Play with Zumi"
              // Land on the stack root (Zumi), not whatever deep screen
              // (e.g. Reels) was left on the Fun stack earlier.
              onPress={() => navigation.navigate('StudyTab', {screen: 'ZumiHome'})}
            />
            <HomeCard
              color="#ec4899"
              icon="📺"
              title="Cartoons"
              subtitle="Watch & giggle"
              comingSoon
            />
          </View>
          <View style={styles.gridRow}>
            <HomeCard
              color="#3b82f6"
              icon="🎬"
              title="Reels"
              subtitle="Cool clips"
              onPress={() => navigation.navigate('ReelsTab')}
            />
            <HomeCard
              color="#10b981"
              icon="🎮"
              title="Games"
              subtitle="Win coins!"
              comingSoon
            />
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

/** Zumi idle art with the same gentle breathing bob as ZumiCharacter. */
function BreathingZumi() {
  const bob = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, {
          toValue: -8,
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
    anim.start();
    return () => anim.stop();
  }, [bob]);

  return (
    <Animated.Image
      source={ZUMI_IDLE}
      resizeMode="contain"
      style={[styles.zumi, {transform: [{translateY: bob}]}]}
    />
  );
}

function Sparkle({style, char}: {style: object; char: string}) {
  return <Text style={[styles.sparkle, style]}>{char}</Text>;
}

function HomeCard({
  color,
  icon,
  title,
  subtitle,
  onPress,
  comingSoon,
}: {
  color: string;
  icon: string;
  title: string;
  subtitle: string;
  onPress?: () => void;
  comingSoon?: boolean;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    if (comingSoon) {
      // Playful bounce + toast instead of navigation.
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.06,
          duration: 90,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          friction: 3,
          useNativeDriver: true,
        }),
      ]).start();
      if (Platform.OS === 'android') {
        ToastAndroid.show('Jald aa raha hai! 🚀', ToastAndroid.SHORT);
      }
      return;
    }
    onPress?.();
  };

  return (
    <Animated.View style={[styles.cardWrap, {transform: [{scale}]}]}>
      <Pressable
        onPress={handlePress}
        android_ripple={{color: 'rgba(255,255,255,0.25)'}}
        style={({pressed}) => [
          styles.card,
          {backgroundColor: color},
          pressed && !comingSoon && styles.cardPressed,
        ]}>
        <View style={styles.cardIconChip}>
          <Text style={styles.cardIcon}>{icon}</Text>
        </View>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardSubtitle}>{subtitle}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#8b5cf6'},
  safe: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  pillRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#ffffff',
    borderRadius: 999,
    paddingVertical: 8,
    elevation: 4,
    shadowColor: '#4c1d95',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: {width: 0, height: 3},
  },
  pillIcon: {fontSize: 15},
  pillText: {fontSize: 16, fontWeight: '800', color: '#7c3aed'},
  zumi: {
    alignSelf: 'center',
    width: 180,
    height: 180,
    marginTop: spacing.md,
  },
  sparkle: {
    position: 'absolute',
    color: 'rgba(255,255,255,0.6)',
    fontSize: 16,
    pointerEvents: 'none',
  },
  bubble: {
    alignSelf: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 22,
    marginTop: spacing.md,
    elevation: 4,
    shadowColor: '#4c1d95',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: {width: 0, height: 3},
  },
  bubbleText: {fontSize: 17, fontWeight: '800', color: '#312e81'},
  grid: {
    flex: 1,
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  gridRow: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.md,
  },
  cardWrap: {flex: 1},
  card: {
    flex: 1,
    borderRadius: 24,
    padding: spacing.md,
    justifyContent: 'flex-end',
    elevation: 6,
    shadowColor: '#4c1d95',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: {width: 0, height: 4},
  },
  cardPressed: {opacity: 0.9},
  cardIconChip: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIcon: {fontSize: 22},
  cardTitle: {fontSize: 22, fontWeight: '900', color: '#ffffff'},
  cardSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    marginTop: 2,
  },
});
