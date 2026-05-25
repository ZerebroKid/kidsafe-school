import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Alert, AppState, StyleSheet, Text, View} from 'react-native';

import {OemSettings, Supervision} from '../../../modules/native';
import {colors, radius, spacing} from '../../../theme';
import {Illustration} from './Illustration';
import {VerificationSheet} from './VerificationSheet';
import {WizardStep} from './WizardStep';
import type {InstructionsStep as Step} from './types';

interface Props {
  step: Step;
  totalSteps: number;
  stepIndex: number;
  timeRemaining?: string;
  onComplete: () => void;
}

/**
 * The "Go to settings" workhorse.
 *
 * Robustness rules (these matter — earlier versions of this screen had silent failure modes
 * that left the user wondering what happened):
 *
 *   1. CTA → `step.openSettings()`. If every fallback intent in the native module rejects, the
 *      promise rejects too. We surface this as a clear alert with a one-tap fallback to the
 *      app's "App info" page so the user can navigate to the toggle manually.
 *   2. When the user returns from a system page, we wait 400ms (some OEMs flush the secure
 *      setting asynchronously) and re-run `step.check()`. If it passes, advance silently.
 *   3. If the auto-detect fails, the verification sheet asks the user. "Yes" runs ONE MORE
 *      check after 600ms before trusting them — that catches the common case where the user
 *      really did grant the permission but our detection lagged. If the second re-check still
 *      fails, we advance anyway (the FinalStep does an authoritative check before allowing
 *      Finish, so a lie can't get the user into the Status screen).
 *   4. "No" reopens the same Settings deep link.
 */
export function InstructionStep({
  step,
  totalSteps,
  stepIndex,
  timeRemaining,
  onComplete,
}: Props) {
  const [opening, setOpening] = useState(false);
  const [showVerify, setShowVerify] = useState(false);
  // Did the user just come back from a system page? Used to gate the "still not granted" prompt.
  const returningFromSettings = useRef(false);

  const recheck = useCallback(async () => {
    try {
      const ok = await step.check();
      if (ok) {
        onComplete();
        return true;
      }
    } catch {
      // ignore — keep the user on this step
    }
    return false;
  }, [step, onComplete]);

  useEffect(() => {
    // Auto-advance if the permission is already granted from a previous attempt (e.g. the wizard
    // is being resumed from a kill-and-relaunch). `requireExplicitConfirm` opts out — that
    // class of step (device admin) must always be acknowledged by a user tap before we trust it.
    if (step.requireExplicitConfirm) {return;}
    recheck();
  }, [recheck, step.requireExplicitConfirm]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', async state => {
      if (state !== 'active') {return;}
      if (!returningFromSettings.current) {return;}
      returningFromSettings.current = false;
      // Tiny delay — some OEMs (Xiaomi) take a moment to flush the secure-setting write.
      await new Promise(r => setTimeout(r, 400));
      // `requireExplicitConfirm` skips the silent advance and always shows the verification
      // sheet so the user must tap "Yes". A dishonest "Yes" is caught by the honest-check in
      // handleVerifyYes (same path as `strict: true`).
      if (step.requireExplicitConfirm) {
        setShowVerify(true);
        return;
      }
      const granted = await recheck();
      if (!granted) {setShowVerify(true);}
    });
    return () => sub.remove();
  }, [recheck, step.requireExplicitConfirm]);

  async function handleOpen() {
    setOpening(true);
    try {
      // The wizard is intentionally about to open a Settings page that the tamper-protection
      // layer would otherwise treat as a "child trying to disable KidSafe" attempt. Arm
      // supervision for 3 minutes so AppBlockerService suppresses the PIN gate while the user
      // walks through the toggle. Auto-expires on its own; FinalStep also disarms explicitly.
      try {
        await Supervision.arm(3 * 60_000);
      } catch {
        // Best-effort. Older builds without the Supervision module shouldn't break onboarding.
      }
      // Optimistically arm the AppState listener — if openSettings throws below we'll disarm it
      // again so the user doesn't get a phantom verification sheet on the next foreground.
      returningFromSettings.current = true;
      await step.openSettings();
    } catch (e) {
      returningFromSettings.current = false;
      const msg =
        (e as Error)?.message ||
        "We couldn't open the right page on this phone.";
      // Surface the failure with a useful next step instead of silently logging.
      Alert.alert(
        "Couldn't open Settings",
        `${msg}\n\nWe can take you to KidSafe's "App info" page instead — find the toggle there and tap "Allow".`,
        [
          {text: 'Cancel', style: 'cancel'},
          {
            text: 'Open App info',
            onPress: async () => {
              try {
                returningFromSettings.current = true;
                await OemSettings.openAppDetailsSettings();
              } catch {
                returningFromSettings.current = false;
              }
            },
          },
        ],
      );
    } finally {
      setOpening(false);
    }
  }

  async function handleVerifyYes() {
    setShowVerify(false);
    // One more honest check before we trust the user's "Yes" — gives the system another moment
    // to propagate the permission write. Common on accessibility toggles with Xiaomi's "Danger"
    // 7s confirmation: by the time the user is back in the app the secure setting is already
    // flipped but we may have re-checked too early.
    await new Promise(r => setTimeout(r, 600));
    try {
      const ok = await step.check();
      if (ok) {
        onComplete();
        return;
      }
    } catch {
      // fall through
    }
    // Strict steps refuse to advance until `check()` actually returns true — used by
    // `locationServicesStep` because a dishonest "Yes" there means the kid never flips on the
    // system Location toggle and the parent map silently stays empty. `requireExplicitConfirm`
    // gets the same treatment so device-admin protection can't be claimed without actually
    // being on; the FinalStep parent-PIN escape hatch remains the documented skip path.
    if (step.strict || step.requireExplicitConfirm) {
      Alert.alert(
        "We still can't detect that change",
        'Please flip the switch in Settings and then come back. KidSafe will check again automatically.',
        [
          {text: 'Cancel', style: 'cancel'},
          {text: 'Open Settings', onPress: handleOpen},
        ],
      );
      return;
    }
    // For unverifiable steps (no public read-back API like MIUI pop-up) we have to trust the
    // user. For verifiable but optional steps (e.g. battery), we also let them through — the
    // FinalStep's authoritative check will warn if it's still missing.
    // For required-but-verifiable steps we still advance: the FinalStep blocks Finish until
    // it really passes, so the user can't accidentally leak past the gate.
    onComplete();
  }

  function handleVerifyNo() {
    setShowVerify(false);
    handleOpen();
  }

  const verifyTitle = step.unverifiable
    ? 'Did you toggle it on?'
    : "We didn't detect the change yet";
  const verifyBody = step.unverifiable
    ? undefined
    : 'If you tapped the toggle but Android takes a moment to register it, choose Yes.';

  return (
    <WizardStep
      totalSteps={totalSteps}
      stepIndex={stepIndex}
      timeRemaining={timeRemaining}
      primaryCta={{label: step.ctaLabel, onPress: handleOpen, loading: opening}}>
      <View style={styles.headerBlock}>
        {step.illustration && (
          <Illustration name={step.illustration} size={120} />
        )}
        <Text style={styles.title}>{step.title}</Text>
        <Text style={styles.subtitle}>{step.subtitle}</Text>
      </View>

      <View style={styles.bulletCard}>
        {step.bullets.map((b, i) => (
          <View key={i} style={styles.bulletRow}>
            <View style={styles.bulletIndex}>
              <Text style={styles.bulletIndexLabel}>{i + 1}</Text>
            </View>
            <Text style={styles.bulletIcon}>{b.icon}</Text>
            <Text style={styles.bulletText}>{b.text}</Text>
          </View>
        ))}
      </View>

      <VerificationSheet
        visible={showVerify}
        title={verifyTitle}
        body={verifyBody}
        onYes={handleVerifyYes}
        onNo={handleVerifyNo}
      />
    </WizardStep>
  );
}

const styles = StyleSheet.create({
  headerBlock: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  title: {
    color: colors.text,
    fontSize: 22,
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
  bulletCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.md,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  bulletIndex: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bulletIndexLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  bulletIcon: {
    fontSize: 22,
    width: 28,
    textAlign: 'center',
  },
  bulletText: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
});
