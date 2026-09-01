import React, {useEffect, useState} from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {signOut} from '@zerebro/shared-firebase/auth';
import {subscribeLinkedChildren} from '@zerebro/shared-firebase/firestore';
import {generatePairingCode} from '../../firebase/pairing';
import {useAuthStore} from '../../state/authStore';
import {useParentTheme} from '../../state/themeStore';
import type {UserDoc} from '@zerebro/shared-types';
import type {ParentStackParamList} from '../../navigation/types';
import {ParentBackground} from './components/ParentBackground';
import {ParentHeader} from './components/ParentHeader';
import {parentRadius, parentSpacing} from './theme/parentTheme';
import {CosmicAssets} from '../../assets/cosmic';

export function SettingsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<ParentStackParamList>>();
  const parentUid = useAuthStore(s => s.firebaseUid);
  const {theme, isDark, themeMode, setThemeMode} = useParentTheme();

  const [children, setChildren] = useState<Array<UserDoc & {uid: string}>>([]);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!parentUid) return;
    return subscribeLinkedChildren(parentUid, setChildren);
  }, [parentUid]);

  async function handleGenerateCode() {
    if (!parentUid) return;
    try {
      setGenerating(true);
      const code = await generatePairingCode(parentUid);
      setPairingCode(code);
    } catch (err: any) {
      Alert.alert('Code Error', err?.message ?? 'Could not generate pairing code.');
    } finally {
      setGenerating(false);
    }
  }

  function confirmSignOut() {
    Alert.alert(
      'Sign out',
      'You will need to sign in again with your phone number.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: () => {
            signOut().catch(err => console.warn('signOut failed', err));
          },
        },
      ],
    );
  }

  return (
    <ParentBackground>
      <ParentHeader
        title="Settings"
        subtitle="Preferences & family account"
        showBack={false}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}>
        {/* App Theme Selector Card */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: isDark
                ? 'rgba(23, 19, 79, 0.88)'
                : theme.cardBg,
              borderColor: theme.cardBorder,
            },
          ]}>
          <Text style={[styles.cardTitle, {color: theme.text}]}>
            App Visual Theme
          </Text>
          <Text style={[styles.cardSub, {color: theme.textMuted}]}>
            Choose your preferred interface theme
          </Text>

          <View style={styles.themeToggleRow}>
            {/* Cosmic Dark Pill */}
            <Pressable
              style={[
                styles.themePill,
                {
                  backgroundColor:
                    themeMode === 'cosmic'
                      ? 'rgba(109, 63, 231, 0.28)'
                      : isDark
                      ? 'rgba(255, 255, 255, 0.06)'
                      : '#FFFFFF',
                  borderColor:
                    themeMode === 'cosmic'
                      ? '#A855F7'
                      : theme.cardBorderSubtle,
                },
              ]}
              onPress={() => setThemeMode('cosmic')}>
              <Text style={{fontSize: 16}}>🌌</Text>
              <View style={styles.themePillMeta}>
                <Text style={[styles.themePillTitle, {color: theme.text}]}>
                  Cosmic Dark
                </Text>
                <Text
                  style={[styles.themePillSub, {color: theme.textSubtle}]}>
                  Night sky & deep navy
                </Text>
              </View>
            </Pressable>

            {/* Day Warm Pill */}
            <Pressable
              style={[
                styles.themePill,
                {
                  backgroundColor:
                    themeMode === 'day'
                      ? 'rgba(225, 29, 83, 0.12)'
                      : isDark
                      ? 'rgba(255, 255, 255, 0.06)'
                      : '#FFFFFF',
                  borderColor:
                    themeMode === 'day'
                      ? '#E11D53'
                      : theme.cardBorderSubtle,
                },
              ]}
              onPress={() => setThemeMode('day')}>
              <Text style={{fontSize: 16}}>☀️</Text>
              <View style={styles.themePillMeta}>
                <Text style={[styles.themePillTitle, {color: theme.text}]}>
                  Day Mode
                </Text>
                <Text
                  style={[styles.themePillSub, {color: theme.textSubtle}]}>
                  Warm paper & crimson
                </Text>
              </View>
            </Pressable>
          </View>
        </View>

        {/* Pair New Child Phone Card */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: isDark
                ? 'rgba(23, 19, 79, 0.88)'
                : theme.cardBg,
              borderColor: theme.cardBorder,
            },
          ]}>
          <Text style={[styles.cardTitle, {color: theme.text}]}>
            Pair a Child Device
          </Text>
          <Text style={[styles.cardSub, {color: theme.textMuted}]}>
            Generate a 6-digit code and enter it on your child's phone during
            setup.
          </Text>

          {pairingCode ? (
            <View
              style={[
                styles.codeBox,
                {
                  backgroundColor: isDark
                    ? 'rgba(7, 11, 43, 0.7)'
                    : '#FFF1F4',
                  borderColor: isDark ? '#A855F7' : theme.primaryBorder,
                },
              ]}>
              <Text style={[styles.codeHint, {color: theme.textMuted}]}>
                PAIRING CODE
              </Text>
              <Text style={[styles.codeText, {color: isDark ? '#35D9FF' : theme.primary}]}>
                {pairingCode}
              </Text>
              <Text style={[styles.codeHint, {color: theme.textSubtle}]}>
                Expires in 10 minutes
              </Text>
            </View>
          ) : null}

          <Pressable
            style={[
              styles.primaryBtn,
              {backgroundColor: theme.primary},
              generating && {opacity: 0.6},
            ]}
            onPress={handleGenerateCode}
            disabled={generating}>
            <Text style={styles.primaryBtnText}>
              {generating ? 'Generating…' : pairingCode ? 'Get New Code' : 'Generate Code'}
            </Text>
          </Pressable>
        </View>

        {/* Linked Children List */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: isDark
                ? 'rgba(23, 19, 79, 0.88)'
                : theme.cardBg,
              borderColor: theme.cardBorder,
            },
          ]}>
          <Text style={[styles.cardTitle, {color: theme.text}]}>
            Linked Children ({children.length})
          </Text>
          {children.length === 0 ? (
            <Text style={[styles.emptyHint, {color: theme.textMuted}]}>
              No child devices linked yet.
            </Text>
          ) : (
            <View style={styles.childrenList}>
              {children.map(c => (
                <Pressable
                  key={c.uid}
                  style={[
                    styles.childRow,
                    {borderBottomColor: theme.cardBorderSubtle},
                  ]}
                  onPress={() =>
                    navigation.navigate('ChildDetails', {
                      childUid: c.uid,
                      childName: c.name ?? c.displayName ?? 'Child',
                    })
                  }>
                  <Image
                    source={CosmicAssets.avatarChild}
                    style={{width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: theme.primary}}
                  />
                  <View style={styles.childInfo}>
                    <Text style={[styles.childName, {color: theme.text}]}>
                      {c.name ?? c.displayName ?? 'Child'}
                    </Text>
                    <Text style={[styles.childSub, {color: theme.textMuted}]}>
                      Tap to manage device controls
                    </Text>
                  </View>
                  <Text style={[styles.chevron, {color: theme.textSubtle}]}>
                    ›
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* School Linkage */}
        <Pressable
          style={[
            styles.menuRow,
            {
              backgroundColor: isDark
                ? 'rgba(23, 19, 79, 0.88)'
                : theme.cardBg,
              borderColor: theme.cardBorder,
            },
          ]}
          onPress={() => navigation.navigate('JoinSchool')}>
          <Image
            source={CosmicAssets.icoSchool}
            style={{width: 32, height: 28}}
            resizeMode="contain"
          />
          <View style={styles.menuMeta}>
            <Text style={[styles.menuTitle, {color: theme.text}]}>
              Link with School
            </Text>
            <Text style={[styles.menuSub, {color: theme.textMuted}]}>
              Connect with your child's class teacher
            </Text>
          </View>
          <Text style={[styles.chevron, {color: theme.textSubtle}]}>›</Text>
        </Pressable>

        {/* Subscription / Family Safety Plan */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: isDark
                ? 'rgba(23, 19, 79, 0.88)'
                : theme.cardBg,
              borderColor: theme.cardBorder,
            },
          ]}>
          <View style={styles.planHeaderRow}>
            <View>
              <Text style={[styles.cardTitle, {color: theme.text}]}>
                Family Pro Plan
              </Text>
              <Text style={[styles.cardSub, {color: theme.textMuted}]}>
                Full parental protection & live learning active
              </Text>
            </View>
            <View
              style={[
                styles.activeBadge,
                {
                  backgroundColor: theme.successGreenBg,
                  borderColor: theme.successGreenBorder,
                },
              ]}>
              <Text style={[styles.activeBadgeText, {color: theme.successGreen}]}>
                ACTIVE
              </Text>
            </View>
          </View>
          <View style={styles.planFeatures}>
            <Text style={[styles.planFeatureItem, {color: theme.textMuted}]}>
              ✓ Unlimited child devices & live GPS
            </Text>
            <Text style={[styles.planFeatureItem, {color: theme.textMuted}]}>
              ✓ Real-time study schedule & app blocker
            </Text>
            <Text style={[styles.planFeatureItem, {color: theme.textMuted}]}>
              ✓ Daily syllabus quiz sync with school
            </Text>
          </View>
        </View>

        {/* Sign Out Button */}
        <Pressable
          style={[
            styles.signOutBtn,
            {
              backgroundColor: theme.dangerBg,
              borderColor: theme.dangerBorder,
            },
          ]}
          onPress={confirmSignOut}>
          <Text style={[styles.signOutText, {color: theme.danger}]}>
            Sign out
          </Text>
        </Pressable>

        {/* App Version Footer */}
        <Text style={[styles.versionText, {color: theme.textSubtle}]}>
          ZConnect Parent App · v2.0
        </Text>

        <View style={{height: 40}} />
      </ScrollView>
    </ParentBackground>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  container: {
    paddingHorizontal: parentSpacing.lg,
    paddingTop: parentSpacing.xs,
    gap: parentSpacing.md,
  },
  card: {
    padding: 18,
    borderRadius: parentRadius.xl,
    borderWidth: 1,
    gap: 12,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  cardSub: {
    fontSize: 12,
    lineHeight: 18,
  },
  themeToggleRow: {
    gap: 10,
    marginTop: 4,
  },
  themePill: {
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  themePillMeta: {
    flex: 1,
  },
  themePillTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  themePillSub: {
    fontSize: 11,
    marginTop: 2,
  },
  codeBox: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    gap: 4,
  },
  codeText: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 4,
  },
  codeHint: {
    fontSize: 11,
  },
  primaryBtn: {
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  emptyHint: {
    fontSize: 13,
  },
  childrenList: {
    gap: 8,
  },
  childRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  childAvatar: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: 'rgba(109, 63, 231, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontSize: 16,
    fontWeight: '700',
  },
  childInfo: {
    flex: 1,
  },
  childName: {
    fontSize: 14,
    fontWeight: '700',
  },
  childSub: {
    fontSize: 11,
    marginTop: 2,
  },
  chevron: {
    fontSize: 20,
  },
  menuRow: {
    padding: 16,
    borderRadius: parentRadius.xl,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  menuMeta: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  menuSub: {
    fontSize: 11,
    marginTop: 2,
  },
  signOutBtn: {
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  signOutText: {
    fontSize: 14,
    fontWeight: '700',
  },
  versionText: {
    textAlign: 'center',
    fontSize: 11,
    paddingVertical: 4,
  },
  planHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  activeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: parentRadius.pill,
    borderWidth: 1,
  },
  activeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  planFeatures: {
    gap: 6,
    marginTop: 4,
  },
  planFeatureItem: {
    fontSize: 12,
    fontWeight: '500',
  },
});
