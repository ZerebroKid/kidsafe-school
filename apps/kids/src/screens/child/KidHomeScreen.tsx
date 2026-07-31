/** Colourful Junior home for children in grade 6 and below. */
import React, {useRef} from 'react';
import {
  Alert,
  Animated,
  Easing,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Svg, {Defs, LinearGradient, Rect, Stop} from 'react-native-svg';
import type {BottomTabScreenProps} from '@react-navigation/bottom-tabs';

import {useChildProfile} from '../../context/ChildProfileContext';
import type {MainTabParamList} from '../../navigation/types';

const ZUMI_IDLE = require('../../assets/zumi/zumi_idle.png');

type Props = BottomTabScreenProps<MainTabParamList, 'HomeTab'>;

export function KidHomeScreen({navigation}: Props) {
  const {childName} = useChildProfile();
  const name = childName || 'dost';

  return (
    <View style={styles.root}>
      <JuniorGradient />
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.statsRow}>
          <View style={styles.statPill}><Text style={styles.statText}>🪙 240</Text></View>
          <View style={styles.statPill}><Text style={styles.statText}>💜 3/10</Text></View>
        </View>

        <Text style={styles.greeting}>Hi {name}! Kaise ho? 🎉</Text>
        <Text style={styles.subGreeting}>Aaj kuch fun karte hain!</Text>

        <View style={styles.zumiStage}>
          <FloatingZumi />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Let's play with Zumi"
            onPress={() => navigation.navigate('StudyTab')}
            style={({pressed}) => [styles.playButton, pressed && styles.playPressed]}>
            <Text style={styles.playButtonIcon}>▶</Text>
          </Pressable>
          <Text style={styles.playLabel}>Let’s play!</Text>
        </View>

        <View style={styles.adventureCard}>
          <Text style={styles.adventureTitle}>Choose your adventure</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open Junior games"
            onPress={() =>
              Alert.alert('Games', 'Junior games are being connected to your school content.')
            }
            style={({pressed}) => [styles.gamesCard, pressed && styles.gamesPressed]}>
            <View style={styles.gamesIcon}><Text style={styles.gamesEmoji}>🕹️</Text></View>
            <View style={styles.gamesCopy}>
              <Text style={styles.gamesTitle}>Games</Text>
              <Text style={styles.gamesSubtitle}>Play, learn and win coins!</Text>
            </View>
            <Text style={styles.gamesArrow}>›</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

function FloatingZumi() {
  const bob = useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, {toValue: -9, duration: 1300, easing: Easing.inOut(Easing.ease), useNativeDriver: true}),
        Animated.timing(bob, {toValue: 0, duration: 1300, easing: Easing.inOut(Easing.ease), useNativeDriver: true}),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [bob]);

  return (
    <Animated.View style={{transform: [{translateY: bob}]}}>
      <Image source={ZUMI_IDLE} resizeMode="contain" style={styles.zumiImage} />
    </Animated.View>
  );
}

function JuniorGradient() {
  return (
    <Svg style={StyleSheet.absoluteFill}>
      <Defs>
        <LinearGradient id="juniorHomeBg" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#6d36f7" />
          <Stop offset="0.52" stopColor="#9446ff" />
          <Stop offset="1" stopColor="#e84ab7" />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#juniorHomeBg)" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#7c3aed'},
  safe: {flex: 1, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 18},
  statsRow: {flexDirection: 'row', justifyContent: 'space-between', gap: 14},
  statPill: {flex: 1, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.96)', paddingVertical: 11, borderRadius: 28},
  statText: {fontSize: 18, fontWeight: '900', color: '#7437ed'},
  greeting: {marginTop: 21, textAlign: 'center', color: '#ffffff', fontSize: 26, fontWeight: '900'},
  subGreeting: {marginTop: 3, textAlign: 'center', color: 'rgba(255,255,255,0.9)', fontSize: 15, fontWeight: '700'},
  zumiStage: {height: 304, alignItems: 'center', justifyContent: 'center', position: 'relative'},
  zumiImage: {width: 192, height: 210},
  playButton: {position: 'absolute', bottom: 37, width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffd54a', borderWidth: 5, borderColor: '#fff4b7', shadowColor: '#4b126f', shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: {width: 0, height: 7}, elevation: 8},
  playButtonIcon: {marginLeft: 4, fontSize: 29, color: '#563500'},
  playLabel: {position: 'absolute', bottom: 7, fontSize: 18, fontWeight: '900', color: '#ffffff'},
  playPressed: {transform: [{scale: 0.93}]},
  adventureCard: {borderRadius: 27, padding: 17, backgroundColor: 'rgba(255,255,255,0.95)', shadowColor: '#39145f', shadowOpacity: 0.22, shadowRadius: 14, shadowOffset: {width: 0, height: 8}, elevation: 5},
  adventureTitle: {fontSize: 16, fontWeight: '900', color: '#39206e'},
  gamesCard: {flexDirection: 'row', alignItems: 'center', gap: 13, borderRadius: 20, padding: 14, marginTop: 12, backgroundColor: '#10bd80'},
  gamesPressed: {opacity: 0.85, transform: [{scale: 0.985}]},
  gamesIcon: {width: 45, height: 45, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.2)'},
  gamesEmoji: {fontSize: 25},
  gamesCopy: {flex: 1},
  gamesTitle: {fontSize: 20, fontWeight: '900', color: '#ffffff'},
  gamesSubtitle: {fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.9)'},
  gamesArrow: {fontSize: 32, lineHeight: 34, color: '#ffffff'},
});
