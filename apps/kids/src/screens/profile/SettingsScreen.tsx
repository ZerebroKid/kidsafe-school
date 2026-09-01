/**
 * SettingsScreen — Settings & Devanagari proof.
 *
 * Design: "Choose Your World" · Settings (Theme picker, Language proof, Preferences).
 */

import React, {useState} from 'react';
import {
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import Svg, {Circle, Path, Rect} from 'react-native-svg';
import {SafeAreaView} from 'react-native-safe-area-context';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {fonts, radius, spacing} from '../../theme';
import type {StudyStackParamList} from '../../navigation/types';
import {useTheme} from '../../context/ThemeContext';

type Props = NativeStackScreenProps<StudyStackParamList, 'Settings'>;

export function SettingsScreen({navigation}: Props) {
  const [language, setLanguage] = useState<'en' | 'hi'>('en');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [offlineDownload, setOfflineDownload] = useState(true);
  const [dataSaver, setDataSaver] = useState(false);
  const {theme} = useTheme();
  const {colors} = theme;

  return (
    <View style={[styles.root, {backgroundColor: colors.bg}]}>
      <StatusBar
        barStyle={colors.isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.bg}
      />
      <SafeAreaView edges={['top']} style={[styles.headerSafe, {backgroundColor: colors.surface, borderBottomColor: colors.border}]}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => navigation.goBack()} style={styles.iconBtn} hitSlop={12}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={colors.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M15 5l-7 7 7 7" />
            </Svg>
          </Pressable>
          <Text style={[styles.headerTitle, {color: colors.text}]}>Settings</Text>
        </View>
      </SafeAreaView>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Language Card with Devanagari proof */}
        <View style={[styles.cardSurface, {backgroundColor: colors.surface, borderColor: colors.border}]}>
          <Text style={[styles.cardOverline, {color: colors.textSecondary}]}>LANGUAGE</Text>
          <View style={[styles.langToggleRow, {backgroundColor: colors.surfaceAlt}]}>
            <Pressable
              style={[
                styles.langBtn,
                language === 'en' && [styles.langBtnActive, {backgroundColor: colors.surface, shadowColor: colors.bg}],
              ]}
              onPress={() => setLanguage('en')}>
              <Text
                style={[
                  styles.langText,
                  language === 'en' ? {color: colors.text, fontWeight: '700'} : {color: colors.mutedText},
                ]}>
                English
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.langBtn,
                language === 'hi' && [styles.langBtnActive, {backgroundColor: colors.surface, shadowColor: colors.bg}],
              ]}
              onPress={() => setLanguage('hi')}>
              <Text
                style={[
                  styles.langTextHindi,
                  language === 'hi' ? {color: colors.text, fontWeight: '700'} : {color: colors.mutedText},
                ]}>
                हिंदी
              </Text>
            </Pressable>
          </View>

          {/* Hindi Proof Preview */}
          <View style={[styles.hindiProofBox, {backgroundColor: colors.surfaceAlt, borderColor: colors.border}]}>
            <Text style={[styles.hindiProofTitle, {color: colors.text}]}>आज का मिशन</Text>
            <Text style={[styles.hindiProofSub, {color: colors.mutedText}]}>रैखिक समीकरण के शब्द प्रश्न · 18 मिनट बाकी</Text>
          </View>
        </View>

        {/* Toggles List Card */}
        <View style={[styles.cardSurface, {backgroundColor: colors.surface, borderColor: colors.border}]}>
          {/* Appearance / Theme Picker Row */}
          <Pressable
            style={styles.settingRow}
            onPress={() => navigation.navigate('ChooseWorld')}>
            <View style={[styles.settingIconBox, {backgroundColor: colors.badgeBg}]}>
              <Svg
                width={20}
                height={20}
                viewBox="0 0 24 24"
                fill="none"
                stroke={colors.primary}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round">
                <Circle cx={12} cy={12} r={9} />
                <Path d="M12 3a9 9 0 0 0 0 18v-18z" />
              </Svg>
            </View>
            <View style={styles.settingTextCol}>
              <Text style={[styles.settingTitle, {color: colors.text}]}>Appearance</Text>
              <Text style={[styles.settingSub, {color: colors.textAccentMuted}]}>
                Theme: {theme.name}
              </Text>
            </View>
            <Svg
              width={20}
              height={20}
              viewBox="0 0 24 24"
              fill="none"
              stroke={colors.mutedText}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round">
              <Path d="M9 5l7 7-7 7" />
            </Svg>
          </Pressable>

          <View style={[styles.divider, {backgroundColor: colors.border}]} />

          {/* Notifications */}
          <View style={styles.settingRow}>
            <View style={[styles.settingIconBox, {backgroundColor: colors.badgeBg}]}>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.primary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M6 10a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6z" />
                <Path d="M10 19a2 2 0 0 0 4 0" />
              </Svg>
            </View>
            <View style={styles.settingTextCol}>
              <Text style={[styles.settingTitle, {color: colors.text}]}>Notifications</Text>
              <Text style={[styles.settingSub, {color: colors.mutedText}]}>Quiet hours 10 PM – 7 AM</Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{false: colors.surfaceAlt, true: colors.primary}}
              thumbColor={colors.onPrimary}
            />
          </View>

          <View style={[styles.divider, {backgroundColor: colors.border}]} />

          {/* Focus Mode */}
          <Pressable style={styles.settingRow} onPress={() => navigation.navigate('FocusMode')}>
            <View style={[styles.settingIconBox, {backgroundColor: 'rgba(255,176,32,0.16)'}]}>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#FFB020" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <Circle cx={12} cy={12} r={8} />
                <Path d="M12 8v4.6l3 1.8" />
              </Svg>
            </View>
            <View style={styles.settingTextCol}>
              <Text style={[styles.settingTitle, {color: colors.text}]}>Focus Mode defaults</Text>
              <Text style={[styles.settingSub, {color: colors.mutedText}]}>6:00 – 7:00 PM · self-controlled</Text>
            </View>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.mutedText} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M9 5l7 7-7 7" />
            </Svg>
          </Pressable>

          <View style={[styles.divider, {backgroundColor: colors.border}]} />

          {/* Download for offline */}
          <View style={styles.settingRow}>
            <View style={[styles.settingIconBox, {backgroundColor: 'rgba(52,231,181,0.16)'}]}>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.success} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
                <Path d="M12 4v12M8 12l4 4 4-4" />
              </Svg>
            </View>
            <View style={styles.settingTextCol}>
              <Text style={[styles.settingTitle, {color: colors.text}]}>Download for offline</Text>
              <Text style={[styles.settingSub, {color: colors.mutedText}]}>Today's mission only · saves data</Text>
            </View>
            <Switch
              value={offlineDownload}
              onValueChange={setOfflineDownload}
              trackColor={{false: colors.surfaceAlt, true: colors.primary}}
              thumbColor={colors.onPrimary}
            />
          </View>

          <View style={[styles.divider, {backgroundColor: colors.border}]} />

          {/* Data Saver */}
          <View style={styles.settingRow}>
            <View style={[styles.settingIconBox, {backgroundColor: colors.badgeBg}]}>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.primary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M3 21h18" />
                <Path d="M6.5 21v-6M11.5 21V7M16.5 21v-9M20.5 21V4" />
              </Svg>
            </View>
            <View style={styles.settingTextCol}>
              <Text style={[styles.settingTitle, {color: colors.text}]}>Data saver</Text>
              <Text style={[styles.settingSub, {color: colors.mutedText}]}>480p video on mobile data</Text>
            </View>
            <Switch
              value={dataSaver}
              onValueChange={setDataSaver}
              trackColor={{false: colors.surfaceAlt, true: colors.primary}}
              thumbColor={colors.onPrimary}
            />
          </View>
        </View>

        {/* Subscription & Account Info */}
        <View style={[styles.cardSurface, {backgroundColor: colors.surface, borderColor: colors.border}]}>
          <Pressable style={styles.settingRow}>
            <Text style={[styles.settingTitleFlex, {color: colors.text}]}>Subscription & billing</Text>
            <View style={[styles.subPriceBadge, {backgroundColor: colors.surfaceAlt}]}>
              <Text style={[styles.subPriceText, {color: colors.textAccentMuted}]}>₹400 / month</Text>
            </View>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.mutedText} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M9 5l7 7-7 7" />
            </Svg>
          </Pressable>

          <View style={[styles.divider, {backgroundColor: colors.border}]} />

          <Pressable style={styles.settingRow}>
            <Text style={[styles.settingTitleFlex, {color: colors.text}]}>Privacy & data</Text>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.mutedText} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M9 5l7 7-7 7" />
            </Svg>
          </Pressable>

          <View style={[styles.divider, {backgroundColor: colors.border}]} />

          <Pressable style={styles.settingRow}>
            <Text style={[styles.settingTitleFlex, {color: colors.text}]}>Help & support</Text>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={colors.mutedText} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M9 5l7 7-7 7" />
            </Svg>
          </Pressable>
        </View>

        {/* Log out CTA */}
        <Pressable
          style={[styles.logoutBtn, {backgroundColor: colors.surface, borderColor: colors.border}]}
          onPress={() => navigation.navigate('SubjectList')}>
          <Text style={[styles.logoutText, {color: colors.accent}]}>Log out</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  headerSafe: {
    borderBottomWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.pagePad,
    paddingVertical: 14,
    gap: 12,
  },
  iconBtn: {
    padding: 4,
  },
  headerTitle: {
    fontFamily: fonts.heading,
    fontSize: 20,
    fontWeight: '700',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.pagePad,
    paddingTop: 16,
    paddingBottom: 32,
    gap: 14,
  },

  // Card Surfaces
  cardSurface: {
    padding: 16,
    borderRadius: 22,
    borderWidth: 1,
    gap: 12,
  },
  cardOverline: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  langToggleRow: {
    flexDirection: 'row',
    borderRadius: radius.pill,
    padding: 4,
  },
  langBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: radius.pill,
  },
  langBtnActive: {
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  langText: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
  },
  langTextHindi: {
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
  },
  hindiProofBox: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 4,
  },
  hindiProofTitle: {
    fontFamily: fonts.heading,
    fontSize: 16,
    fontWeight: '700',
  },
  hindiProofSub: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
  },

  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  settingIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingTextCol: {
    flex: 1,
    gap: 2,
  },
  settingTitle: {
    fontFamily: fonts.heading,
    fontSize: 15,
    fontWeight: '600',
  },
  settingSub: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
  },
  settingTitleFlex: {
    flex: 1,
    fontFamily: fonts.heading,
    fontSize: 15,
    fontWeight: '600',
  },
  subPriceBadge: {
    paddingHorizontal: 10,
    height: 24,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subPriceText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    fontWeight: '700',
  },
  divider: {
    height: 1,
  },
  logoutBtn: {
    height: 52,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  logoutText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    fontWeight: '700',
  },
});
