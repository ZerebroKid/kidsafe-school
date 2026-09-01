import React, {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {firebase} from '@react-native-firebase/firestore';

import {paths} from '@zerebro/shared-firebase/firestore';
import {
  AppBlocker,
  DeviceAdmin,
  ForegroundService,
  Location,
  OemSettings,
  ScreenTime,
  Supervision,
} from '../../../modules/native';
import {colors, radius, spacing} from '../../../theme';
import {Illustration} from './Illustration';
import {ParentPinPromptModal} from './ParentPinPromptModal';
import {WizardStep} from './WizardStep';
import type {FinalStep as Step} from './types';

interface Props {
  step: Step;
  totalSteps: number;
  stepIndex: number;
  childUid: string;
  /** Lets the user jump back to a missing-permission step. */
  jumpToStep: (stepId: string) => void;
}

/**
 * One row of the "Still missing" / "Already granted" audit list.
 *
 *   - `id`   matches the step id in the OEM step lists (so `jumpToStep` knows where to send us).
 *   - `kind` decides whether we let the user finish:
 *     - `required` = ChildNavigator gates on this. Finish is disabled until it passes.
 *     - `recommended` = warns but does not block (e.g. battery exemption — useful but the
 *       FG service can survive without it on most ROMs).
 */
type AuditEntry = {
  id: string;
  label: string;
  kind: 'required' | 'recommended';
  granted: boolean;
};

/**
 * "All set!" screen + final permission audit.
 *
 * The wizard's earlier steps each handle their own permission individually, but a user can
 * still arrive here with one or more permissions un-granted: e.g. they tapped "Yes" on the
 * verification sheet without actually flipping the toggle, or the OEM-specific deep link
 * silently failed and they backed out. ChildNavigator gates on accessibility + overlay +
 * usage access + fine location + foreground-service-running, so if any of those are still
 * false at this point, tapping Finish would do nothing visible: the FG service starts but
 * the navigator stays parked on PermissionsOnboarding and the user is stuck.
 *
 * This screen is the safety net. It re-audits every critical permission on mount and every
 * time the app comes back to the foreground, blocks Finish until they all pass, and offers
 * one-tap "Fix it" buttons that jump back to the corresponding wizard step.
 */
export function FinalStep({
  step,
  totalSteps,
  stepIndex,
  childUid,
  jumpToStep,
}: Props) {
  const [audit, setAudit] = useState<AuditEntry[] | null>(null);
  const [busy, setBusy] = useState(false);
  // Drives the parent-PIN modal that gates the "skip device admin" escape hatch. Holding it
  // here keeps the destructive flow declarative and re-checkable.
  const [showSkipPinModal, setShowSkipPinModal] = useState(false);

  // -- Audit ----------------------------------------------------------------------------------

  const runAudit = useCallback(async () => {
    // `gpsOn` is the system-wide Location / GPS master switch (distinct from the per-app
    // `ACCESS_FINE_LOCATION` permission `fine` reads above). We audit both because Realme/
    // ColorOS routinely lets the kid grant "Allow all the time" but leaves the master toggle
    // off — in that state `LocationWriter` cannot acquire a fix and the parent map silently
    // sits empty. Catching it here gives the kid a one-tap "fix it" jump back to the
    // dedicated `locationServicesStep`.
    const [access, overlay, usage, fine, gpsOn, battery, deviceAdmin] = await Promise.all([
      AppBlocker.isAccessibilityServiceEnabled().catch(() => false),
      AppBlocker.canDrawOverlays().catch(() => false),
      ScreenTime.hasUsageAccess().catch(() => false),
      Location.hasLocationPermission().catch(() => false),
      Location.isLocationServicesEnabled().catch(() => false),
      OemSettings.isIgnoringBatteryOptimizations().catch(() => true),
      DeviceAdmin.isActive().catch(() => false),
    ]);
    setAudit([
      {
        id: 'accessibility',
        label: 'Accessibility — needed to detect the foreground app',
        kind: 'required',
        granted: access,
      },
      {
        id: 'overlay',
        label: 'Display over other apps — needed to show the block screen',
        kind: 'required',
        granted: overlay,
      },
      {
        id: 'usageAccess',
        label: 'Usage access — needed for screen time and daily limits',
        kind: 'required',
        granted: usage,
      },
      {
        // Soft-recommended (per design) so that phones where activation flakes (Infinix /
        // Tecno / certain MIUI builds) still let the user finish onboarding. The Finish
        // handler shows an explicit warning when this is missing.
        id: 'deviceAdmin',
        label:
          'Uninstall protection — prevents the child from removing KidSafe',
        kind: 'recommended',
        granted: deviceAdmin,
      },
      {
        id: 'locationForeground',
        label: 'Location — needed for the live map and safe-zone alerts',
        kind: 'required',
        granted: fine,
      },
      {
        id: 'locationServices',
        label: 'GPS / Location switch — must be ON so the phone can get a fix',
        kind: 'required',
        granted: gpsOn,
      },
      {
        id: 'battery',
        label: 'Battery exemption — keeps KidSafe alive in the background',
        kind: 'recommended',
        granted: battery,
      },
    ]);
  }, []);

  useEffect(() => {
    runAudit();
  }, [runAudit]);

  // Re-audit whenever the app comes back from a fix excursion.
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') {runAudit();}
    });
    return () => sub.remove();
  }, [runAudit]);

  // -- Finish ---------------------------------------------------------------------------------

  /**
   * Polls `ForegroundService.isRunning` for up to `maxMs` after we trigger a start. The
   * service registers itself asynchronously (Android schedules onCreate / onStartCommand on
   * the main thread), so a single check immediately after `start()` can return false even on
   * a happy path. Wait until we either see it or hit the timeout.
   */
  async function waitForFgService(maxMs = 6000): Promise<boolean> {
    const startedAt = Date.now();
    while (Date.now() - startedAt < maxMs) {
      const running = await ForegroundService.isRunning().catch(() => false);
      if (running) {return true;}
      await new Promise(r => setTimeout(() => r(null), 300));
    }
    return false;
  }

  async function handleFinish() {
    if (!audit) {return;}
    const missingRequired = audit.filter(a => a.kind === 'required' && !a.granted);
    if (missingRequired.length > 0) {
      // Defensive: the button should already be disabled. Surface a clear message anyway.
      Alert.alert(
        'Missing permissions',
        `Please grant: ${missingRequired.map(a => a.id).join(', ')}.`,
      );
      return;
    }
    if (!childUid) {
      Alert.alert(
        'Not signed in',
        "We couldn't read your account id. Please sign out and sign back in.",
      );
      return;
    }

    // Hard gate: if uninstall protection isn't on, the only way past this screen is for the
    // parent to physically enter the parent PIN to acknowledge that uninstall cannot be
    // blocked on this device. The child cannot click through it because PIN verification is
    // done against the salted hash stored at PIN setup.
    const deviceAdminMissing = audit.some(
      a => a.id === 'deviceAdmin' && !a.granted,
    );
    if (deviceAdminMissing) {
      Alert.alert(
        'Uninstall protection is required',
        "Without device admin, your child can long-press KidSafe and uninstall it. KidSafe cannot work as a parental control without this — please activate it.",
        [
          {text: 'Activate now', onPress: () => jumpToStep('deviceAdmin')},
          {
            text: 'Skip with parent PIN',
            style: 'destructive',
            onPress: () => setShowSkipPinModal(true),
          },
        ],
      );
      return;
    }

    await continueFinish();
  }

  /**
   * Called when the parent enters the correct PIN in the skip modal. Logs the skip to Firestore
   * for parent visibility, then proceeds to the normal Finish flow. Wrong PINs are handled
   * inside [ParentPinPromptModal] (it stays open and shows an error).
   */
  async function handleConfirmSkipDeviceAdmin() {
    setShowSkipPinModal(false);
    try {
      await logDeviceAdminSkipped();
    } catch {
      // Best-effort: a missing alert event shouldn't block onboarding.
    }
    await continueFinish();
  }

  async function continueFinish() {
    setBusy(true);
    // Onboarding is over — disarm the supervision window so the tamper-protection gate re-arms
    // immediately. (It would auto-expire after 3 min anyway, but disarming here closes the gap
    // between Finish and the auto-expiry where a child could open Settings unguarded.)
    try {
      await Supervision.disarm();
    } catch {
      // Best-effort.
    }
    try {
      await ForegroundService.start(childUid);
    } catch (e) {
      setBusy(false);
      Alert.alert(
        'Could not start monitoring',
        (e as Error)?.message ||
          'KidSafe could not start its background service. Please reboot the device and try again.',
      );
      return;
    }

    const running = await waitForFgService();
    setBusy(false);

    if (!running) {
      // FG service didn't materialise within the timeout. On Xiaomi/Vivo this almost always
      // means the battery saver killed it. Steer the user to the battery step.
      Alert.alert(
        "We couldn't keep KidSafe running",
        'The background service was killed by the system — usually because battery optimisation is still on. Please grant the battery exemption and try again.',
        [
          {text: 'Cancel', style: 'cancel'},
          {text: 'Fix battery', onPress: () => jumpToStep('battery')},
        ],
      );
      return;
    }
    // Happy path: FG service is up. ChildNavigator's 3-second poll will pick this up on the
    // next tick and swap us out for the Status screen — there's nothing else to do here.
  }

  /**
   * Silent Firestore event logged when the user finishes onboarding without device admin.
   * Surfaces in the parent's "Recent uninstall attempts" panel alongside other tamper events
   * (mirrors the schema used by `AccessibilityWatchdog` / `PinGateActivity` on the native side).
   */
  async function logDeviceAdminSkipped() {
    if (!childUid) {return;}
    await paths.events(childUid).add({
      type: 'tamper_attempt',
      kind: 'device_admin_skipped_at_setup',
      success: true,
      timestamp: Date.now(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  }

  // -- Render --------------------------------------------------------------------------------

  if (!audit) {
    return (
      <WizardStep
        totalSteps={totalSteps}
        stepIndex={stepIndex}
        primaryCta={{label: 'Checking…', onPress: () => {}, disabled: true}}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.subtitle}>Checking permissions…</Text>
        </View>
      </WizardStep>
    );
  }

  const missingRequired = audit.filter(a => a.kind === 'required' && !a.granted);
  const missingRecommended = audit.filter(
    a => a.kind === 'recommended' && !a.granted,
  );
  const allRequiredGranted = missingRequired.length === 0;

  return (
    <WizardStep
      totalSteps={totalSteps}
      stepIndex={stepIndex}
      primaryCta={{
        label: allRequiredGranted ? step.ctaLabel : 'Fix permissions to finish',
        onPress: handleFinish,
        loading: busy,
        disabled: !allRequiredGranted,
      }}>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.celebrationBlock}>
          <Illustration
            name={allRequiredGranted ? 'celebrate' : 'shield'}
            size={allRequiredGranted ? 200 : 160}
          />
          <Text style={styles.title}>
            {allRequiredGranted
              ? step.title
              : 'Almost there — a few permissions still need attention'}
          </Text>
          <Text style={styles.subtitle}>
            {allRequiredGranted
              ? step.subtitle
              : "Tap any item below to jump back to it. KidSafe can't run reliably until everything in red is fixed."}
          </Text>
        </View>

        {/* Required audit list — only show if anything is missing or recommended is missing */}
        {(!allRequiredGranted || missingRecommended.length > 0) && (
          <View style={styles.auditCard}>
            <Text style={styles.auditTitle}>Permissions checklist</Text>
            {audit.map(a => (
              <Pressable
                key={a.id}
                onPress={() => jumpToStep(a.id)}
                style={({pressed}) => [
                  styles.auditRow,
                  pressed && {opacity: 0.85},
                ]}>
                <Text
                  style={[
                    styles.auditDot,
                    a.granted
                      ? styles.auditDotGranted
                      : a.kind === 'required'
                        ? styles.auditDotMissingRequired
                        : styles.auditDotMissingRecommended,
                  ]}>
                  {a.granted ? '✓' : a.kind === 'required' ? '✕' : '!'}
                </Text>
                <View style={styles.auditTextBlock}>
                  <Text style={styles.auditLabel}>{a.label}</Text>
                  {!a.granted && (
                    <Text
                      style={[
                        styles.auditHint,
                        a.kind === 'required'
                          ? styles.auditHintRequired
                          : styles.auditHintRecommended,
                      ]}>
                      {a.kind === 'required'
                        ? 'Required — tap to fix'
                        : 'Recommended — tap to fix'}
                    </Text>
                  )}
                </View>
              </Pressable>
            ))}
          </View>
        )}

        {allRequiredGranted && (
          <View style={styles.tipCard}>
            <Text style={styles.tipTitle}>How to test that blocking works</Text>
            <Text style={styles.tipText}>
              From your parent's KidSafe app, tap any app on this device's app list and
              toggle "Blocked". Then open that app on this phone — the KidSafe block screen
              should appear.
            </Text>
          </View>
        )}
      </ScrollView>

      <ParentPinPromptModal
        visible={showSkipPinModal}
        title="Skip uninstall protection?"
        message="Enter the parent PIN to acknowledge that KidSafe cannot prevent uninstall on this device. The child will be able to long-press and remove the app."
        confirmLabel="Skip protection"
        destructive
        onConfirm={handleConfirmSkipDeviceAdmin}
        onCancel={() => setShowSkipPinModal(false)}
      />
    </WizardStep>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingVertical: spacing.lg,
    gap: spacing.lg,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  celebrationBlock: {
    alignItems: 'center',
    gap: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  auditCard: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  auditTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  auditRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  auditDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    textAlign: 'center',
    lineHeight: 24,
    fontWeight: '700',
    fontSize: 14,
    overflow: 'hidden',
  },
  auditDotGranted: {
    backgroundColor: colors.success,
    color: colors.primaryText,
  },
  auditDotMissingRequired: {
    backgroundColor: colors.danger,
    color: colors.primaryText,
  },
  auditDotMissingRecommended: {
    backgroundColor: colors.warning,
    color: colors.primaryText,
  },
  auditTextBlock: {
    flex: 1,
  },
  auditLabel: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
  },
  auditHint: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  auditHintRequired: {
    color: colors.danger,
  },
  auditHintRecommended: {
    color: colors.warning,
  },
  tipCard: {
    backgroundColor: colors.surfaceAlt,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  tipTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  tipText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
});
