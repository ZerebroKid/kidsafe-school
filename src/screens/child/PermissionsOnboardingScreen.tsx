import React, {useCallback, useEffect, useState} from 'react';
import {
  Alert,
  AppState,
  PermissionsAndroid,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {Screen} from '../../components/Screen';
import {colors, radius, spacing} from '../../theme';
import {AppBlocker, ForegroundService, Location, ScreenTime} from '../../modules/native';
import {useAuthStore} from '../../state/authStore';

interface Step {
  id: string;
  title: string;
  description: string;
  check: () => Promise<boolean>;
  request: () => Promise<void>;
}

/**
 * Walks the child through every permission / special-access setting KidSafe needs on the phone.
 * Mirrors Fig 7.6 from the KidSafe book (minus the SMS / Call-log screens which we deferred post-MVP
 * per Play Store policy).
 */
export function PermissionsOnboardingScreen() {
  const uid = useAuthStore(s => s.firebaseUid);

  const steps: Step[] = [
    {
      id: 'notifications',
      title: 'Notifications',
      description: 'Allows KidSafe to show its ongoing status.',
      check: async () => {
        if (Number(require('react-native').Platform.Version) < 33) return true;
        const res = await PermissionsAndroid.check(
          'android.permission.POST_NOTIFICATIONS' as unknown as never,
        );
        return res;
      },
      request: async () => {
        await PermissionsAndroid.request(
          'android.permission.POST_NOTIFICATIONS' as unknown as never,
        );
      },
    },
    {
      id: 'location',
      title: 'Location',
      description: "Lets your parent see where you are on the map. Required for geofencing.",
      check: async () => Location.hasLocationPermission(),
      request: async () => {
        await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
        ]);
      },
    },
    {
      id: 'backgroundLocation',
      title: 'Background location',
      description: 'Keeps location updating even when the app is not open.',
      check: async () =>
        PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
        ),
      request: async () => {
        await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
        );
      },
    },
    {
      id: 'contacts',
      title: 'Contacts',
      description: "Shares your contacts list with your parent so they can call them too.",
      check: async () =>
        PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_CONTACTS),
      request: async () => {
        await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_CONTACTS);
      },
    },
    {
      id: 'usage',
      title: 'Usage access',
      description: 'Needed to count screen time. You will open a system settings screen.',
      check: ScreenTime.hasUsageAccess,
      request: ScreenTime.openUsageAccessSettings,
    },
    {
      id: 'overlay',
      title: 'Display over other apps',
      description: 'Lets KidSafe show a block screen when you open a restricted app.',
      check: AppBlocker.canDrawOverlays,
      request: AppBlocker.openOverlaySettings,
    },
    {
      id: 'accessibility',
      title: 'Accessibility service',
      description:
        'Required for app blocking. KidSafe only reads the package name of apps you open — no content.',
      check: AppBlocker.isAccessibilityServiceEnabled,
      request: AppBlocker.openAccessibilitySettings,
    },
    // Device admin step intentionally omitted from the UI. Some OEM skins (Infinix, MIUI,
    // ColorOS) block the activation intent entirely, leaving the user stuck. The remote-lock
    // feature still calls into `DeviceAdminModule.lockNow()` when it's active, and becomes a
    // no-op when it isn't.
  ];

  const [done, setDone] = useState<Record<string, boolean>>({});
  const [checking, setChecking] = useState(false);

  const recheck = useCallback(async () => {
    setChecking(true);
    try {
      const results = await Promise.all(steps.map(s => s.check().catch(() => false)));
      const next: Record<string, boolean> = {};
      steps.forEach((s, i) => {
        next[s.id] = results[i];
      });
      setDone(next);
    } finally {
      setChecking(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    recheck();
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') recheck();
    });
    return () => sub.remove();
  }, [recheck]);

  const allDone = steps.every(s => done[s.id]);

  async function finish() {
    if (!uid) return;
    try {
      await ForegroundService.start(uid);
    } catch (e) {
      Alert.alert('Could not start monitoring', (e as Error).message);
      return;
    }
    // App.tsx will navigate to Status when it sees the foreground service running.
  }

  return (
    <Screen title="Let's set up your phone" subtitle="Grant each permission below. You can come back to any you skip.">
      {steps.map(s => (
        <StepRow
          key={s.id}
          title={s.title}
          description={s.description}
          done={!!done[s.id]}
          onPress={async () => {
            await s.request();
            // Give the user a moment to return from the system screen before re-checking
            setTimeout(recheck, 300);
          }}
        />
      ))}

      <Pressable
        onPress={finish}
        disabled={!allDone}
        style={({pressed}) => [
          styles.finishButton,
          {
            backgroundColor: allDone ? colors.success : colors.surfaceAlt,
            opacity: pressed ? 0.85 : 1,
          },
        ]}>
        <Text style={styles.finishLabel}>{allDone ? "I'm done" : 'Finish remaining steps'}</Text>
      </Pressable>

      {checking && <Text style={{color: colors.textMuted, textAlign: 'center'}}>Re-checking…</Text>}
    </Screen>
  );
}

function StepRow({
  title,
  description,
  done,
  onPress,
}: {
  title: string;
  description: string;
  done: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({pressed}) => [styles.row, {opacity: pressed ? 0.85 : 1}]}>
      <View style={[styles.dot, done && {backgroundColor: colors.success, borderColor: colors.success}]} />
      <View style={{flex: 1}}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowDesc}>{description}</Text>
      </View>
      <Text style={styles.rowCta}>{done ? 'Done' : 'Grant'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.md,
    gap: spacing.md,
  },
  dot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.border,
  },
  rowTitle: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 15,
  },
  rowDesc: {
    color: colors.textMuted,
    marginTop: 4,
    fontSize: 13,
  },
  rowCta: {
    color: colors.primary,
    fontWeight: '700',
  },
  finishButton: {
    marginTop: spacing.lg,
    padding: spacing.md,
    alignItems: 'center',
    borderRadius: radius.md,
  },
  finishLabel: {
    fontWeight: '700',
    color: colors.primaryText,
  },
});
