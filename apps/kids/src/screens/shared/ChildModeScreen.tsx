import React, {useEffect, useMemo, useState} from 'react';
import {
  BackHandler,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

import {AppBlocker} from '../../modules/native';
import {colors, radius, spacing} from '../../theme';
import {
  sharedProfileChildUid,
  subscribeChildApps,
  subscribeChildDoc,
} from '../../firebase/firestore';
import {useAuthStore} from '../../state/authStore';
import type {AppEntry, ChildDoc} from '@zerebro/shared-types';
import type {ChildModeStackParamList} from '../../navigation/types';

type Nav = NativeStackNavigationProp<ChildModeStackParamList, 'ChildMode'>;

/**
 * Locked kiosk home screen.
 *
 * Renders:
 *   - A bold "Child Mode" header so it's instantly obvious which mode the phone is in.
 *   - The schedule's allowlist (if active) or the un-blocked apps (if not in a schedule
 *     window) as a grid of tappable launchers — tapping launches the app via the platform
 *     intent. Blocked apps are NOT shown so the child isn't tempted.
 *   - A small "Exit Child Mode" link routed through PIN entry. We deliberately use a
 *     subdued link, not a primary button, so the child doesn't slap it on instinct.
 *
 * Hardware back is captured to a no-op so the child can't accidentally land on the
 * dashboard via swipe-back / home-button / back-button combos.
 *
 * Navigation here is intentionally minimal — every screen the child might want lives
 * outside KidSafe. The `AppBlockerService` keeps blocking enforced for everything not
 * in the allowlist, so even if the child knows how to summon another app via the
 * launcher, KidSafe pops `BlockedAppActivity` over it.
 */
export function ChildModeScreen() {
  const navigation = useNavigation<Nav>();
  const parentUid = useAuthStore(s => s.firebaseUid);
  const sharedProfile = useAuthStore(s => s.userDoc?.sharedProfile);
  const childUid = sharedProfile?.childUid ?? (parentUid ? sharedProfileChildUid(parentUid) : '');

  const [apps, setApps] = useState<AppEntry[]>([]);
  const [childDoc, setChildDoc] = useState<ChildDoc | null>(null);

  useEffect(() => {
    if (!childUid) {return;}
    return subscribeChildApps(childUid, setApps);
  }, [childUid]);
  useEffect(() => {
    if (!childUid) {return;}
    return subscribeChildDoc(childUid, setChildDoc);
  }, [childUid]);

  // Trap hardware back. Returning true means "handled, don't propagate".
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  // What apps should we surface as launchable tiles?
  //  - If the parent's schedule is currently active, show ONLY the allowlist.
  //  - Otherwise, show every NOT-blocked app the child has installed.
  // Either way, blocked apps are hidden — they're enforced by AppBlockerService anyway,
  // so hiding them just removes the "tap and bounce" experience.
  const allowed = useMemo(() => {
    if (!childDoc) {return [];}
    const sched = childDoc.schedule;
    if (sched?.enabled && isScheduleActiveNow(sched)) {
      const allowSet = new Set(sched.allowedPackages);
      return apps.filter(a => allowSet.has(a.packageName));
    }
    return apps.filter(a => !a.isBlocked);
  }, [apps, childDoc]);

  async function launch(pkg: string) {
    try {
      await AppBlocker.launchApp(pkg);
    } catch {
      // App may have been uninstalled mid-session — ignore. The grid will refresh on the
      // next Firestore snapshot.
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View style={styles.headerDot} />
        <Text style={styles.headerTitle}>Child Mode</Text>
        {sharedProfile?.childName ? (
          <Text style={styles.headerSubtitle}>for {sharedProfile.childName}</Text>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {allowed.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Nothing to use right now</Text>
            <Text style={styles.emptyBody}>
              Your parent has not allowed any apps for this time. Ask them to update Child
              Mode if you need something.
            </Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {allowed.map(app => (
              <Pressable
                key={app.packageName}
                onPress={() => launch(app.packageName)}
                style={({pressed}) => [styles.tile, pressed && styles.tilePressed]}>
                {app.icon ? (
                  <Image source={{uri: app.icon}} style={styles.tileIcon} />
                ) : (
                  <View style={[styles.tileIcon, styles.tileIconFallback]}>
                    <Text style={styles.tileIconFallbackText}>
                      {app.appName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <Text style={styles.tileLabel} numberOfLines={2}>
                  {app.appName}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable onPress={() => navigation.navigate('ExitPin')}>
          <Text style={styles.exitLink}>Exit Child Mode (parent only)</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

/**
 * Local mirror of `KidSafeStore.isScheduleActiveNow` so the kiosk can decide what to render
 * without a native round-trip. Native is still the authoritative enforcer for blocking.
 */
function isScheduleActiveNow(sched: NonNullable<ChildDoc['schedule']>): boolean {
  const now = new Date();
  const dow = now.getDay();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const {startMinutes: start, endMinutes: end, daysOfWeek} = sched;
  const onDay = (d: number) => daysOfWeek.includes(d);

  if (start <= end) {
    return onDay(dow) && nowMins >= start && nowMins < end;
  }
  // Wraps midnight.
  if (onDay(dow) && nowMins >= start) {return true;}
  const yday = (dow + 6) % 7;
  if (onDay(yday) && nowMins < end) {return true;}
  return false;
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.warning,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: colors.textMuted,
    fontSize: 14,
    marginLeft: spacing.xs,
  },
  body: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    gap: spacing.md,
  },
  tile: {
    width: '30%',
    aspectRatio: 0.9,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  tilePressed: {
    opacity: 0.7,
  },
  tileIcon: {
    width: 48,
    height: 48,
    borderRadius: 10,
  },
  tileIconFallback: {
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileIconFallbackText: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '700',
  },
  tileLabel: {
    color: colors.text,
    fontSize: 12,
    textAlign: 'center',
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.sm,
    borderLeftWidth: 4,
    borderLeftColor: colors.warning,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  emptyBody: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: 'center',
  },
  exitLink: {
    color: colors.textMuted,
    fontSize: 13,
  },
});
