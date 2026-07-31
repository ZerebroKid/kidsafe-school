/**
 * Junior home for children in grade 6 and below.
 *
 * This is the native version of the approved beta Zumi design. The child name
 * is live profile data; navigation continues to use the existing Zumi and
 * Reels flows rather than a static demo.
 */
import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import type {BottomTabScreenProps} from '@react-navigation/bottom-tabs';

import {useChildProfile} from '../../context/ChildProfileContext';
import type {MainTabParamList} from '../../navigation/types';
import {ZiboMascot} from '../fun/components/ZiboMascot';

type Props = BottomTabScreenProps<MainTabParamList, 'HomeTab'>;

export function KidHomeScreen({navigation}: Props) {
  const {childName} = useChildProfile();
  const name = childName || 'dost';

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <Text style={styles.greeting}>Hi {name}! ☀️</Text>
        <Text style={styles.subGreeting}>Let’s learn something fun today</Text>

        <View style={styles.mascotArea}>
          <ZiboMascot />
          <View style={styles.topicBubble}>
            <Text style={styles.topicBubbleText}>Today: let’s explore! ★</Text>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Start a fun learning activity"
          onPress={() => navigation.navigate('StudyTab')}
          style={({pressed}) => [styles.playCard, pressed && styles.pressed]}>
          <Text style={styles.playIcon}>🎮</Text>
          <View style={styles.playCopy}>
            <Text style={styles.playTitle}>Let’s play!</Text>
            <Text style={styles.playSubtitle}>A fun learning activity</Text>
          </View>
          <Text style={styles.playArrow}>▶</Text>
        </Pressable>

        <View style={styles.moodRow}>
          <Mood emoji="😀" label="Happy" color="#f08a32" border="#ffe0c2" />
          <Mood emoji="🤔" label="Curious" color="#38a9f2" border="#d7ecff" />
          <Mood emoji="🥳" label="Excited" color="#f26b9b" border="#ffe0ee" />
        </View>

        <View style={styles.exploreCard}>
          <Text style={styles.exploreTitle}>Choose your adventure</Text>
          <View style={styles.exploreRow}>
            <Pressable
              accessibilityRole="button"
              onPress={() => navigation.navigate('StudyTab')}
              style={({pressed}) => [styles.exploreAction, pressed && styles.pressed]}>
              <Text style={styles.exploreEmoji}>✨</Text>
              <Text style={styles.exploreLabel}>Learn</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => navigation.navigate('ReelsTab')}
              style={({pressed}) => [styles.exploreAction, pressed && styles.pressed]}>
              <Text style={styles.exploreEmoji}>🎬</Text>
              <Text style={styles.exploreLabel}>Reels</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

function Mood({emoji, label, color, border}: {emoji: string; label: string; color: string; border: string}) {
  return (
    <View style={[styles.mood, {borderColor: border}]}>
      <Text style={styles.moodEmoji}>{emoji}</Text>
      <Text style={[styles.moodLabel, {color}]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#fff7ee'},
  safe: {flex: 1, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 18},
  greeting: {textAlign: 'center', color: '#4c3ae3', fontSize: 23, fontWeight: '900'},
  subGreeting: {textAlign: 'center', color: '#c2870f', fontSize: 14, fontWeight: '700', marginTop: 2},
  mascotArea: {height: 194, alignItems: 'center', justifyContent: 'flex-end', marginTop: 2},
  topicBubble: {position: 'absolute', right: 7, top: 4, borderWidth: 2, borderColor: '#ffd54a', borderRadius: 16, borderBottomLeftRadius: 4, backgroundColor: '#ffffff', paddingHorizontal: 10, paddingVertical: 7, shadowColor: '#4c3ae3', shadowOpacity: 0.12, shadowRadius: 8, elevation: 3},
  topicBubbleText: {fontSize: 11, fontWeight: '800', color: '#4c3ae3'},
  playCard: {flexDirection: 'row', alignItems: 'center', borderRadius: 27, backgroundColor: '#ff735e', paddingHorizontal: 21, paddingVertical: 19, marginTop: 4, shadowColor: '#ff6b5c', shadowOpacity: 0.38, shadowRadius: 14, shadowOffset: {width: 0, height: 7}, elevation: 6},
  playIcon: {fontSize: 36, marginRight: 13},
  playCopy: {flex: 1},
  playTitle: {fontSize: 23, color: '#ffffff', fontWeight: '900'},
  playSubtitle: {fontSize: 14, color: '#ffffff', opacity: 0.92, fontWeight: '700'},
  playArrow: {fontSize: 25, color: '#ffffff'},
  moodRow: {flexDirection: 'row', gap: 11, marginTop: 15},
  mood: {flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: 21, borderWidth: 2, backgroundColor: '#ffffff'},
  moodEmoji: {fontSize: 28},
  moodLabel: {fontSize: 11, fontWeight: '900', marginTop: 3},
  exploreCard: {marginTop: 17, borderRadius: 22, padding: 14, backgroundColor: '#ffffff'},
  exploreTitle: {fontSize: 14, fontWeight: '900', color: '#3a3a55'},
  exploreRow: {flexDirection: 'row', gap: 12, marginTop: 10},
  exploreAction: {flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 16, paddingVertical: 10, backgroundColor: '#f1edff'},
  exploreEmoji: {fontSize: 18},
  exploreLabel: {fontSize: 13, fontWeight: '900', color: '#4c3ae3'},
  pressed: {opacity: 0.78, transform: [{scale: 0.98}]},
});
