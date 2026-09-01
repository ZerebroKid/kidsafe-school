import React from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

import {signOut} from '@zerebro/shared-firebase/auth';
import {
  useTeacherActiveSchool,
  useTeacherClasses,
} from '../../firebase/teacher';
import {useAuthStore} from '../../state/authStore';
import type {TeacherStackParamList} from '../../navigation/types';
import {cosmicColors, cosmicRadius, cosmicSpacing} from './theme';
import {CosmicBackground} from './components/CosmicBackground';
import {CosmicHeader} from './components/CosmicHeader';

type Props = NativeStackScreenProps<TeacherStackParamList, 'TeacherMore'>;

function getInitials(name: string): string {
  if (!name) return 'TR';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function TeacherMoreScreen({navigation}: Props) {
  const uid = useAuthStore(s => s.firebaseUid);
  const schoolState = useTeacherActiveSchool(uid);
  const classesState = useTeacherClasses(schoolState.data?.schoolId ?? null, uid);

  const teacherName = schoolState.data?.displayName ?? 'Teacher';
  const schoolName = 'Sunrise Public School';
  const initials = getInitials(teacherName);
  const classCount = classesState.data?.length ?? 3;

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

  const menuRows = [
    {
      label: 'My classes',
      meta: `${classCount}`,
      onPress: () => navigation.navigate('TeacherClasses'),
    },
    {
      label: 'Notifications',
      meta: '3 new',
      onPress: () => navigation.navigate('TeacherNotifications'),
    },
    {
      label: 'Reports & insights',
      meta: '',
      onPress: () => navigation.navigate('TeacherReports'),
    },
    {
      label: 'Curriculum & board',
      meta: 'CBSE',
      onPress: () => {},
    },
    {
      label: 'School timetable',
      meta: 'Mon–Sat',
      onPress: () => {},
    },
    {
      label: 'Help & support',
      meta: '',
      onPress: () => {},
    },
  ];

  return (
    <CosmicBackground>
      <CosmicHeader
        title="More"
        subtitle="Account & settings"
        showBack={false}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}>
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.profileMeta}>
            <Text style={styles.name}>{teacherName}</Text>
            <Text style={styles.sub}>{schoolName}</Text>
          </View>
        </View>

        {/* Menu Rows */}
        <View style={styles.menuList}>
          {menuRows.map(r => (
            <Pressable
              key={r.label}
              style={styles.menuRow}
              onPress={r.onPress}>
              <Text style={styles.menuLabel}>{r.label}</Text>
              <Text style={styles.menuMeta}>{r.meta}</Text>
            </Pressable>
          ))}
        </View>

        {/* Sign Out Button */}
        <Pressable style={styles.signOutBtn} onPress={confirmSignOut}>
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>

        {/* App Version Footer */}
        <Text style={styles.versionText}>ZerebroKid Teacher · v2.0</Text>

        <View style={{height: 40}} />
      </ScrollView>
    </CosmicBackground>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  container: {
    paddingHorizontal: cosmicSpacing.lg,
    paddingTop: cosmicSpacing.xs,
    gap: cosmicSpacing.md,
  },
  profileCard: {
    padding: 18,
    borderRadius: cosmicRadius.xl,
    backgroundColor: 'rgba(139, 92, 246, 0.22)',
    borderWidth: 1,
    borderColor: cosmicColors.purpleBorder,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: 'rgba(139, 92, 246, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: cosmicColors.purpleSoft,
    fontSize: 18,
    fontWeight: '700',
  },
  profileMeta: {
    flex: 1,
  },
  name: {
    color: cosmicColors.text,
    fontSize: 19,
    fontWeight: '700',
  },
  sub: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    marginTop: 3,
  },
  menuList: {
    gap: 10,
  },
  menuRow: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: cosmicColors.cardBgSubtle,
    borderWidth: 1,
    borderColor: cosmicColors.cardBorderSubtle,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  menuLabel: {
    color: cosmicColors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  menuMeta: {
    color: cosmicColors.textSubtle,
    fontSize: 12,
  },
  signOutBtn: {
    height: 54,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: cosmicColors.pinkBorder,
    backgroundColor: cosmicColors.pinkBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  signOutText: {
    color: cosmicColors.pinkLight,
    fontSize: 14,
    fontWeight: '700',
  },
  versionText: {
    textAlign: 'center',
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.3)',
    paddingVertical: 4,
  },
});
