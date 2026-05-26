import React, {useCallback, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';

import {setPrimaryRole} from '@zerebro/shared-firebase/auth';
import type {Role} from '@zerebro/shared-types';

import {useAuthStore} from '../state/authStore';
import {colors, radius, spacing} from '../theme';

/**
 * Multi-role pill switcher rendered above the root navigator in ZConnect.
 *
 * Visibility rule: ONLY rendered when the user holds 2+ roles. Single-role
 * users never see this UI -- the wrapping `RootNavigator` is responsible for
 * passing `userDoc.roles.length >= 2` before mounting us, so this component
 * itself does no visibility math.
 *
 * Persistence: tapping a pill calls `setPrimaryRole(uid, role)` which UPDATES
 * `users/{uid}.primaryRole` in Firestore. The auth store's onSnapshot listener
 * picks the change up and re-renders the navigator; we also optimistically set
 * the local store so the pill flips instantly and doesn't feel laggy.
 *
 * Defence-in-depth: `setPrimaryRole` rejects roles the user doesn't hold (the
 * helper itself checks the persisted roles[]) -- the pill list comes from the
 * doc's `roles[]` so a tampered local store can't pick an unauthorised role.
 *
 * Styling: matches the rest of ZConnect (StyleSheet + theme tokens). NativeWind
 * is installed in the project but `Button.tsx` documents a CSS-Interop bug that
 * dropped explicit backgroundColor styles, so we stick to StyleSheet here.
 */
export function RoleSwitcher() {
  const uid = useAuthStore(s => s.firebaseUid);
  const userDoc = useAuthStore(s => s.userDoc);
  const setUserDoc = useAuthStore(s => s.setUserDoc);
  const [busyRole, setBusyRole] = useState<Role | null>(null);

  const onPick = useCallback(
    async (role: Role) => {
      if (!uid || !userDoc) return;
      if (userDoc.primaryRole === role) return;
      if (!userDoc.roles.includes(role)) return;
      const previous = userDoc.primaryRole;
      setBusyRole(role);
      // Optimistic update so the pill flips instantly. If the write fails we
      // roll back below; the onSnapshot listener will overwrite us either way
      // on the next server tick which is the source of truth.
      setUserDoc({...userDoc, primaryRole: role});
      try {
        await setPrimaryRole(uid, role);
      } catch (err) {
        console.warn('RoleSwitcher: setPrimaryRole failed, rolling back', err);
        setUserDoc({...userDoc, primaryRole: previous});
      } finally {
        setBusyRole(null);
      }
    },
    [uid, userDoc, setUserDoc],
  );

  if (!userDoc || userDoc.roles.length < 2) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Mode</Text>
      <View style={styles.pillRow}>
        {userDoc.roles.map(role => {
          const active = userDoc.primaryRole === role;
          const busy = busyRole === role;
          return (
            <Pressable
              key={role}
              onPress={() => onPick(role)}
              disabled={active || busy}
              android_ripple={{color: 'rgba(255,255,255,0.18)'}}
              style={[styles.pill, active && styles.pillActive]}>
              <Text style={[styles.pillText, active && styles.pillTextActive]}>
                {formatRole(role)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function formatRole(role: Role): string {
  switch (role) {
    case 'admin':
      return 'Admin';
    case 'principal':
      return 'Principal';
    case 'teacher':
      return 'Teacher';
    case 'parent':
      return 'Parent';
    case 'child':
      return 'Child';
  }
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    backgroundColor: colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  label: {
    color: colors.textMuted,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontWeight: '600',
  },
  pillRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    flex: 1,
  },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pillText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  pillTextActive: {
    color: colors.primaryText,
  },
});
