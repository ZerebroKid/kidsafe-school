import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  ToastAndroid,
  View,
  type ViewToken,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Svg, {Circle, Path, Rect} from 'react-native-svg';
import Video, {type ReactVideoProps, type VideoRef} from 'react-native-video';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {JuniorStackParamList} from '../../navigation/types';
import {fonts, junior, neutral, radius, shadows, spacing} from '../../theme';
import {useChildProfile} from '../../context/ChildProfileContext';
import {useReelsFeed} from '../../firebase/reels';

const VideoPlayer = Video as unknown as React.ComponentType<
  ReactVideoProps & React.RefAttributes<VideoRef>
>;

type Props = NativeStackScreenProps<JuniorStackParamList, 'KidReels'>;

const {width: SCREEN_W, height: SCREEN_H} = Dimensions.get('window');

export interface JuniorReelItem {
  id: string;
  title: string;
  caption: string;
  authorName: string;
  authorAvatarText: string;
  videoUrl: string;
  imageSource?: any;
  likes: number;
  topicTag: string;
  soundName: string;
}

const FALLBACK_REELS: JuniorReelItem[] = [
  {
    id: '1',
    title: 'Tamatar aur Aloo',
    caption: 'Tamatar aur Aloo ki masti — dekho aur haso! 🍅🥔',
    authorName: 'ZerebroKid Junior',
    authorAvatarText: 'Z',
    videoUrl:
      'https://firebasestorage.googleapis.com/v0/b/kidsafe-e5eac.firebasestorage.app/o/reels%2Fclassifying_things_01.mp4?alt=media&token=aca49df3-ad1d-4976-8c74-35a3f27975b0',
    imageSource: require('../../assets/kid-reels.png'),
    likes: 1420,
    topicTag: 'Fun Break',
    soundName: 'Original Sound - ZerebroKid',
  },
  {
    id: '2',
    title: 'States of Matter',
    caption: 'Solid, Liquid, Gas — Paani ke teen roop! 🧊💧💨',
    authorName: 'Science Junior',
    authorAvatarText: 'S',
    videoUrl:
      'https://firebasestorage.googleapis.com/v0/b/kidsafe-e5eac.firebasestorage.app/o/reels%2Ffun_01.mp4?alt=media&token=86911303-0272-488e-8797-7833b4948719',
    imageSource: require('../../assets/kid-cartoons.png'),
    likes: 980,
    topicTag: 'Science',
    soundName: 'States of Matter Song',
  },
  {
    id: '3',
    title: 'Chanda Mama Door Ke',
    caption: 'Ghar par sungao yeh pyaari kavita! 🌙✨',
    authorName: 'Rhymes Corner',
    authorAvatarText: 'R',
    videoUrl:
      'https://firebasestorage.googleapis.com/v0/b/kidsafe-e5eac.firebasestorage.app/o/reels%2Ffun_02.mp4?alt=media&token=8e5a0a4d-6b1e-4f6d-9a56-ff578639ddde',
    imageSource: require('../../assets/kid-fun.png'),
    likes: 2150,
    topicTag: 'Rhymes',
    soundName: 'Chanda Mama - Junior Mix',
  },
  {
    id: '4',
    title: 'Big vs Small',
    caption: 'Chhota aur bada seekhein Zumi ke saath! 🐱🎈',
    authorName: 'Maths Explorer',
    authorAvatarText: 'M',
    videoUrl:
      'https://firebasestorage.googleapis.com/v0/b/kidsafe-e5eac.firebasestorage.app/o/reels%2Ffun_03.mp4?alt=media&token=281a93cd-d2e1-4791-b507-54d5953f8049',
    imageSource: require('../../assets/kid-hero.png'),
    likes: 1890,
    topicTag: 'Maths & Logic',
    soundName: 'Big & Small Fun Track',
  },
];

export function KidReelsScreen({navigation}: Props) {
  const {childGrade} = useChildProfile();
  const {data: firestoreFeed} = useReelsFeed(childGrade);
  const [activeIndex, setActiveIndex] = useState(0);

  // Combine Firestore reels data if present, or fallback to full sample dataset
  const reelsList: JuniorReelItem[] = React.useMemo(() => {
    if (firestoreFeed && firestoreFeed.length > 0) {
      return firestoreFeed.map((doc, idx) => ({
        id: doc.reelId || `fs_${idx}`,
        title: doc.title || 'Junior Reel',
        caption: doc.title || 'ZerebroKid Junior Fun Clip',
        authorName: 'ZerebroKid Junior',
        authorAvatarText: 'Z',
        videoUrl: doc.videoUrl,
        imageSource: FALLBACK_REELS[idx % FALLBACK_REELS.length].imageSource,
        likes: 1000 + idx * 240,
        topicTag: doc.kind === 'topic' ? 'Study' : 'Fun Break',
        soundName: 'Original Audio',
      }));
    }
    return FALLBACK_REELS;
  }, [firestoreFeed]);

  const onViewableItemsChanged = useRef(
    ({viewableItems}: {viewableItems: ViewToken[]}) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setActiveIndex(viewableItems[0].index);
      }
    },
  ).current;

  const viewConfigRef = useRef({viewAreaCoveragePercentThreshold: 60}).current;

  const renderItem = useCallback(
    ({item, index}: {item: JuniorReelItem; index: number}) => {
      return (
        <ReelSingleCard
          item={item}
          isActive={index === activeIndex}
          onBack={() => navigation.goBack()}
        />
      );
    },
    [activeIndex, navigation],
  );

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Instagram Reels Style Vertical Fullscreen Feed */}
      <FlatList
        data={reelsList}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={SCREEN_H}
        snapToAlignment="start"
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewConfigRef}
        getItemLayout={(_, index) => ({
          length: SCREEN_H,
          offset: SCREEN_H * index,
          index,
        })}
      />

      {/* Bottom Pagination Dots */}
      <View style={styles.dotsOverlay} pointerEvents="none">
        {reelsList.map((_, i) => (
          <View
            key={i}
            style={[styles.dot, i === activeIndex && styles.activeDot]}
          />
        ))}
      </View>
    </View>
  );
}

function ReelSingleCard({
  item,
  isActive,
  onBack,
}: {
  item: JuniorReelItem;
  isActive: boolean;
  onBack: () => void;
}) {
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(item.likes);
  const [isMuted, setIsMuted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isActive) {
      setPaused(true);
    } else {
      setPaused(false);
    }
  }, [isActive]);

  const toggleLike = () => {
    setIsLiked(prev => {
      const next = !prev;
      setLikeCount(c => (next ? c + 1 : c - 1));
      return next;
    });
  };

  const handleShare = () => {
    const msg = `Check out "${item.title}" on ZerebroKid Junior!`;
    if (Platform.OS === 'android') {
      ToastAndroid.show(msg, ToastAndroid.SHORT);
    } else {
      Alert.alert('Share Reel', msg);
    }
  };

  const toggleSound = () => {
    setIsMuted(prev => !prev);
  };

  const togglePlayPause = () => {
    setPaused(prev => !prev);
  };

  return (
    <Pressable style={styles.cardRoot} onPress={togglePlayPause}>
      {/* Background Poster / Image */}
      {item.imageSource && (
        <Image source={item.imageSource} style={styles.bgImg} resizeMode="cover" />
      )}

      {/* Video Player */}
      {item.videoUrl ? (
        <VideoPlayer
          source={{uri: item.videoUrl}}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          repeat
          paused={paused || !isActive}
          muted={isMuted}
          onLoadStart={() => setIsLoading(true)}
          onReadyForDisplay={() => setIsLoading(false)}
          onError={() => setIsLoading(false)}
        />
      ) : null}

      {/* Dark Overlay for readability */}
      <View style={styles.darkGradientOverlay} pointerEvents="none" />

      {/* Buffering Indicator */}
      {isLoading && isActive && (
        <View style={styles.loaderWrap} pointerEvents="none">
          <ActivityIndicator size="large" color={neutral.surface} />
        </View>
      )}

      {/* Play / Pause Indicator overlay on tap */}
      {paused && isActive && !isLoading && (
        <View style={styles.pauseOverlay} pointerEvents="none">
          <View style={styles.pauseCircle}>
            <Svg width={38} height={38} viewBox="0 0 24 24" fill="#FFFFFF">
              <Path d="M8 5l11 7-11 7z" />
            </Svg>
          </View>
        </View>
      )}

      {/* UI Overlay */}
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        {/* Top Header */}
        <View style={styles.header}>
          <Pressable
            style={styles.backBtn}
            onPress={onBack}
            android_ripple={{color: 'rgba(255,255,255,0.2)', borderless: true, radius: 23}}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M15 5l-7 7 7 7" />
            </Svg>
          </Pressable>
          <Text style={styles.headerTitle}>Reels</Text>
        </View>

        {/* Bottom Content & Actions Row */}
        <View style={styles.contentRow}>
          {/* Left Info Column */}
          <View style={styles.infoCol}>
            {/* Topic Tag Pill */}
            <View style={styles.topicPill}>
              <Text style={styles.topicTagText}>{item.topicTag}</Text>
            </View>

            {/* Author Row */}
            <View style={styles.authorRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{item.authorAvatarText}</Text>
              </View>
              <Text style={styles.authorName}>{item.authorName}</Text>
            </View>

            {/* Caption */}
            <Text style={styles.caption}>{item.caption}</Text>

            {/* Sound bar */}
            <View style={styles.soundRow}>
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M9 18V5l12-2v13" />
                <Circle cx={6} cy={18} r={3} />
                <Circle cx={18} cy={16} r={3} />
              </Svg>
              <Text style={styles.soundText}>{item.soundName}</Text>
            </View>
          </View>

          {/* Right Actions Column */}
          <View style={styles.actionsCol}>
            {/* Like */}
            <View style={styles.actionItem}>
              <Pressable
                style={[
                  styles.actionBtn,
                  isLiked && styles.actionBtnLiked,
                ]}
                onPress={toggleLike}
                android_ripple={{color: 'rgba(255,255,255,0.2)', borderless: true, radius: 28}}>
                <Svg
                  width={30}
                  height={30}
                  viewBox="0 0 24 24"
                  fill={isLiked ? '#FF4D8D' : 'none'}
                  stroke={isLiked ? '#FF4D8D' : '#FFFFFF'}
                  strokeWidth={2.2}
                  strokeLinecap="round"
                  strokeLinejoin="round">
                  <Path d="M12 21s-7.5-4.7-7.5-10A4.5 4.5 0 0 1 12 7.6 4.5 4.5 0 0 1 19.5 11c0 5.3-7.5 10-7.5 10z" />
                </Svg>
              </Pressable>
              <Text style={styles.actionText}>{likeCount}</Text>
            </View>

            {/* Share */}
            <View style={styles.actionItem}>
              <Pressable
                style={styles.actionBtn}
                onPress={handleShare}
                android_ripple={{color: 'rgba(255,255,255,0.2)', borderless: true, radius: 28}}>
                <Svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M12 16V4M8 8l4-4 4 4" />
                  <Path d="M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" />
                </Svg>
              </Pressable>
              <Text style={styles.actionText}>Share</Text>
            </View>

            {/* Sound Toggle */}
            <View style={styles.actionItem}>
              <Pressable
                style={styles.actionBtn}
                onPress={toggleSound}
                android_ripple={{color: 'rgba(255,255,255,0.2)', borderless: true, radius: 28}}>
                <Svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke={isMuted ? '#FF4D8D' : '#FFFFFF'} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                  {isMuted ? (
                    <Path d="M11 5L6 9H2v6h4l5 4V5zM23 9l-6 6M17 9l6 6" />
                  ) : (
                    <Path d="M6 9v6M12 5v14M18 9v6" />
                  )}
                </Svg>
              </Pressable>
              <Text style={styles.actionText}>{isMuted ? 'Mute' : 'Sound'}</Text>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#100A22',
  },
  cardRoot: {
    width: SCREEN_W,
    height: SCREEN_H,
    position: 'relative',
    backgroundColor: '#100A22',
  },
  bgImg: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  darkGradientOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(16,10,34,0.40)',
  },
  loaderWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pauseCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 4,
  },
  safe: {
    flex: 1,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md12,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    zIndex: 10,
  },
  backBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontFamily: fonts.headingExtraBold,
    fontSize: 24,
    color: neutral.surface,
    top: 1,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 14,
    paddingHorizontal: spacing.md,
    paddingBottom: 28,
    zIndex: 10,
  },
  infoCol: {
    flex: 1,
    gap: spacing.sm,
  },
  topicPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  topicTagText: {
    fontFamily: fonts.heading,
    fontSize: 12,
    color: neutral.surface,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: junior.purplePillText,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: fonts.headingExtraBold,
    fontSize: 17,
    color: neutral.surface,
  },
  authorName: {
    fontFamily: fonts.heading,
    fontSize: 18,
    color: neutral.surface,
  },
  caption: {
    fontFamily: fonts.heading,
    fontSize: 16,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.95)',
  },
  soundRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  soundText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
  },
  actionsCol: {
    alignItems: 'center',
    gap: 18,
  },
  actionItem: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  actionBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnLiked: {
    backgroundColor: 'rgba(255,77,141,0.20)',
  },
  actionText: {
    fontFamily: fonts.heading,
    fontSize: 13,
    color: neutral.surface,
  },
  dotsOverlay: {
    position: 'absolute',
    bottom: spacing.md,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    zIndex: 20,
  },
  dot: {
    width: spacing.sm,
    height: spacing.sm,
    borderRadius: spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  activeDot: {
    width: 20,
    backgroundColor: neutral.surface,
  },
});
