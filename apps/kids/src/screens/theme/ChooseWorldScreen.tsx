/**
 * ChooseWorldScreen — Theme Picker.
 *
 * Design: "Choose Your World" · Screen 01.
 * Lives in Settings → Appearance (navigated from ProfileScreen → SettingsScreen).
 *
 * Architecture: unchanged. Only themeId changes.
 */

import React, {useState} from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, {Circle, Path} from 'react-native-svg';
import {SafeAreaView} from 'react-native-safe-area-context';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {THEMES, type ThemeDefinition, type ThemeId} from '../../theme/themes';
import {useTheme} from '../../context/ThemeContext';
import {fonts, radius, spacing} from '../../theme';
import type {StudyStackParamList} from '../../navigation/types';

type Props = {
  navigation?: any;
  route?: any;
  onComplete?: () => void;
  isFirstLaunch?: boolean;
};

// ─────────────────────────────────────────────────────────────────────────────
// Color swatches component
// ─────────────────────────────────────────────────────────────────────────────

function Swatch({color, size = 20}: {color: string; size?: number}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 6,
        backgroundColor: color,
      }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Theme Card — full-image card (Velocity, Future City, Fantasy Quest)
// ─────────────────────────────────────────────────────────────────────────────

function ThemeImageCard({
  theme,
  isSelected,
  onPress,
}: {
  theme: ThemeDefinition;
  isSelected: boolean;
  onPress: () => void;
}) {
  const imgHeight = isSelected ? 92 : 78;

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.card,
        isSelected ? styles.cardSelected : styles.cardUnselected,
      ]}>
      {/* Banner image */}
      <View style={{position: 'relative', height: imgHeight}}>
        <Image
          source={theme.images.themeCover}
          style={[styles.cardImage, {height: imgHeight}]}
          resizeMode="cover"
        />
        {/* Gradient overlay at bottom */}
        <View style={styles.cardImageGradient} />
        {/* Selected badge */}
        {isSelected && (
          <View style={styles.selectedBadge}>
            <Text style={styles.selectedBadgeText}>Selected</Text>
          </View>
        )}
        {/* Title area */}
        <View style={styles.cardTitleArea}>
          <Text style={styles.cardTitle}>{theme.name}</Text>
          <Text style={[styles.cardTagline, {color: theme.colors.textAccentMuted}]}>
            {theme.tagline}
          </Text>
        </View>
      </View>
      {/* Bottom row: swatches + themeId */}
      <View style={styles.cardFooter}>
        <Swatch color={theme.swatches.primary} size={isSelected ? 20 : 18} />
        <Swatch color={theme.swatches.secondary} size={isSelected ? 20 : 18} />
        <Swatch color={theme.swatches.tertiary} size={isSelected ? 20 : 18} />
        <Swatch
          color={theme.swatches.bg}
          size={isSelected ? 20 : 18}
        />
        <Text style={[styles.cardThemeId, {color: theme.colors.textAccentMuted}]}>
          {theme.id}
        </Text>
      </View>
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Classic Card — flat row style (no banner image)
// ─────────────────────────────────────────────────────────────────────────────

function ClassicCard({
  isSelected,
  onPress,
}: {
  isSelected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.classicCard,
        isSelected ? styles.cardSelected : styles.cardUnselected,
      ]}>
      {/* Violet gradient icon */}
      <View style={styles.classicIconBox}>
        <Svg
          width={24}
          height={24}
          viewBox="0 0 24 24"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round">
          <Path d="M4 10.5L12 4l8 6.5V20a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" />
        </Svg>
      </View>
      <View style={styles.classicTextWrap}>
        <Text style={styles.classicTitle}>ZerebroKid Classic</Text>
        <Text style={styles.classicSub}>The original light violet design · default</Text>
      </View>
      <Text style={styles.cardThemeId}>classic</Text>
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────

export function ChooseWorldScreen({navigation, onComplete, isFirstLaunch}: Props) {
  const {theme: activeTheme, themeId, setThemeId} = useTheme();
  const [selectedId, setSelectedId] = useState<ThemeId>(themeId);

  const activeDraft = THEMES[selectedId] ?? THEMES.classic;

  const handleApply = () => {
    setThemeId(selectedId);
    if (onComplete) {
      onComplete();
    } else if (navigation) {
      navigation.goBack();
    }
  };

  const handleBack = () => {
    if (onComplete) {
      onComplete();
    } else if (navigation) {
      navigation.goBack();
    }
  };

  const themeList: ThemeId[] = ['velocity', 'future-city', 'fantasy-quest', 'classic'];

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safeTop}>
        {/* Header */}
        <View style={styles.header}>
          {!isFirstLaunch && (
            <Pressable onPress={handleBack} hitSlop={12}>
              <Svg
                width={24}
                height={24}
                viewBox="0 0 24 24"
                fill="none"
                stroke="#FFFFFF"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round">
                <Path d="M15 5l-7 7 7 7" />
              </Svg>
            </Pressable>
          )}
          <View style={styles.headerTextWrap}>
            <Text style={styles.headerTitle}>Choose your world</Text>
            <Text style={styles.headerSub}>Your app, your look. Study stays the same.</Text>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>

        {/* Theme cards */}
        {themeList.map(id => {
          const t = THEMES[id];
          const isSelected = selectedId === id;
          if (id === 'classic') {
            return (
              <ClassicCard
                key={id}
                isSelected={isSelected}
                onPress={() => setSelectedId(id)}
              />
            );
          }
          return (
            <ThemeImageCard
              key={id}
              theme={t}
              isSelected={isSelected}
              onPress={() => setSelectedId(id)}
            />
          );
        })}

        {/* Info banner */}
        <View style={styles.infoBanner}>
          <Svg
            width={20}
            height={20}
            viewBox="0 0 24 24"
            fill="none"
            stroke="#00E5FF"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round">
            <Circle cx={12} cy={12} r={9} />
            <Path d="M12 16v-4M12 8h.01" />
          </Svg>
          <Text style={styles.infoText}>
            Changing your world only changes how the app looks. Your topics, quiz
            results and reports stay exactly the same.
          </Text>
        </View>

        {/* Apply CTA */}
        <Pressable
          onPress={handleApply}
          style={({pressed}) => [styles.applyBtn, pressed && styles.applyBtnPressed]}>
          <Text style={styles.applyBtnText}>Apply {activeDraft.name}</Text>
        </Pressable>

        <View style={{height: 24}} />
      </ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles — dark base matching design doc
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0A0716',
  },
  safeTop: {
    backgroundColor: '#0A0716',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: spacing.pagePad,
    paddingTop: 16,
    paddingBottom: 16,
  },
  headerTextWrap: {
    flex: 1,
    gap: 1,
  },
  headerTitle: {
    fontFamily: fonts.heading,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerSub: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    fontWeight: '500',
    color: '#8E86AD',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.pagePad,
    paddingTop: 6,
    gap: 12,
  },

  // Image-banner card (Velocity, Future City, Fantasy Quest)
  card: {
    borderRadius: 22,
    overflow: 'hidden',
  },
  cardSelected: {
    borderWidth: 2,
    borderColor: '#00E5FF',
    shadowColor: '#00E5FF',
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: {width: 0, height: 0},
    elevation: 8,
  },
  cardUnselected: {
    borderWidth: 1.5,
    borderColor: '#2A2148',
  },
  cardImage: {
    width: '100%',
  },
  cardImageGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 64,
    backgroundColor: 'transparent',
    // Simulated gradient via opacity on dark bg
  },
  selectedBadge: {
    position: 'absolute',
    right: 12,
    top: 12,
    flexDirection: 'row',
    alignItems: 'center',
    height: 26,
    paddingHorizontal: 11,
    borderRadius: 999,
    backgroundColor: '#00E5FF',
  },
  selectedBadgeText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: '#04222A',
  },
  cardTitleArea: {
    position: 'absolute',
    left: 14,
    bottom: 9,
    gap: 1,
  },
  cardTitle: {
    fontFamily: fonts.headingExtraBold,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  cardTagline: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
    fontWeight: '600',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 11,
    paddingHorizontal: 14,
    backgroundColor: '#120C24',
  },
  cardThemeId: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    color: '#8E86AD',
    marginLeft: 'auto',
  },

  // Classic flat card
  classicCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    backgroundColor: '#120C24',
    borderRadius: 22,
  },
  classicIconBox: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    // Gradient-simulated with a violet background
    // (LinearGradient not available in StyleSheet — use inline if needed)
  },
  classicTextWrap: {
    flex: 1,
    gap: 2,
  },
  classicTitle: {
    fontFamily: fonts.heading,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  classicSub: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
    fontWeight: '500',
    color: '#8E86AD',
  },

  // Info banner
  infoBanner: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(0,229,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0,229,255,0.22)',
    marginTop: 4,
  },
  infoText: {
    flex: 1,
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
    color: '#C9C2E0',
  },

  // Apply button
  applyBtn: {
    height: 56,
    borderRadius: 999,
    backgroundColor: '#00E5FF', // fallback; LinearGradient would be ideal
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    shadowColor: '#00E5FF',
    shadowOpacity: 0.28,
    shadowRadius: 20,
    shadowOffset: {width: 0, height: 10},
    elevation: 8,
  },
  applyBtnPressed: {
    opacity: 0.92,
    transform: [{scale: 0.98}],
  },
  applyBtnText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    fontWeight: '700',
    color: '#0A0716',
  },
});
