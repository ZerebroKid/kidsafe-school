import React from 'react';
import {Image, ScrollView, StyleSheet, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';

import {useChildProfile} from '../../context/ChildProfileContext';
import {useAuthStore} from '../../state/authStore';
import {colors, radius, spacing} from '../../theme';

/**
 * Account display for a signed-in child.
 *
 * Names and photo URLs come from `users/{uid}`; no profile details are
 * hard-coded. Local-photo selection is intentionally not exposed until the
 * backend agrees a Firebase Storage path and access rules for child media.
 */
export function ProfileScreen() {
  const {childName, childGrade} = useChildProfile();
  const userDoc = useAuthStore(s => s.userDoc);
  const displayName = childName || userDoc?.displayName || userDoc?.name || 'Student';
  const initial = displayName.trim().charAt(0).toUpperCase() || 'S';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Me</Text>

        <View style={styles.profileCard}>
          {userDoc?.photoURL ? (
            <Image source={{uri: userDoc.photoURL}} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarLetter}>{initial}</Text>
            </View>
          )}
          <View style={styles.profileText}>
            <Text style={styles.name}>{displayName}</Text>
            <Text style={styles.meta}>
              {childGrade === null ? 'Your school profile' : `Class ${childGrade}`}
            </Text>
          </View>
        </View>

        <View style={styles.noticeCard}>
          <Text style={styles.noticeTitle}>Your school profile</Text>
          <Text style={styles.noticeCopy}>
            Your name and account details come from your secure ZerebroKid profile.
          </Text>
        </View>

        <View style={styles.detailCard}>
          <Text style={styles.detailLabel}>SIGNED-IN ACCOUNT</Text>
          <Text style={styles.detailValue}>{userDoc?.email ?? 'School account'}</Text>
        </View>

        <View style={styles.helpCard}>
          <Text style={styles.helpTitle}>Need help?</Text>
          <Text style={styles.helpCopy}>Ask your parent, teacher or school coordinator for support.</Text>
          <Text style={styles.helpEmail}>help@zerebrokid.com</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {flex: 1, backgroundColor: colors.bg},
  screen: {flex: 1, backgroundColor: colors.bg},
  content: {padding: spacing.lg, paddingBottom: spacing.xl, gap: spacing.lg},
  title: {fontSize: 28, fontWeight: '800', color: colors.text, letterSpacing: -0.5},
  profileCard: {flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: '#f0edff'},
  avatarImage: {width: 68, height: 68, borderRadius: 34, backgroundColor: '#ddd8ff'},
  avatarFallback: {width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary},
  avatarLetter: {fontSize: 28, fontWeight: '800', color: colors.primaryText},
  profileText: {flex: 1, gap: 4},
  name: {fontSize: 21, fontWeight: '800', color: colors.text},
  meta: {fontSize: 14, color: colors.textMuted, fontWeight: '600'},
  noticeCard: {borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: spacing.xs, backgroundColor: colors.surface},
  noticeTitle: {fontSize: 16, fontWeight: '800', color: colors.text},
  noticeCopy: {fontSize: 13, lineHeight: 20, color: colors.textMuted},
  detailCard: {borderRadius: radius.md, padding: spacing.md, gap: spacing.xs, backgroundColor: '#f8f8fb'},
  detailLabel: {fontSize: 11, fontWeight: '800', letterSpacing: 0.8, color: colors.textMuted},
  detailValue: {fontSize: 14, fontWeight: '700', color: colors.text},
  helpCard: {borderRadius: radius.md, padding: spacing.md, gap: spacing.xs, backgroundColor: '#e7f7ee'},
  helpTitle: {fontSize: 16, fontWeight: '800', color: '#16633f'},
  helpCopy: {fontSize: 13, lineHeight: 19, color: '#397358'},
  helpEmail: {fontSize: 14, fontWeight: '800', color: '#16633f', marginTop: 2},
});
