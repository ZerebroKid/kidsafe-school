import type {Permission} from 'react-native';

import type {IllustrationName} from './Illustration';

/**
 * Discriminated union of every wizard step shape. Each entry in the OEM step arrays
 * (`steps/xiaomi.ts`, `steps/samsung.ts`, `steps/generic.ts`) is one of these.
 *
 *   - `illustration` — friendly intro screen (mascot + title + CTA).
 *   - `instructions` — numbered "1. Tap X, 2. Tap Y" with a "Go to settings" deep link.
 *   - `runtime`      — single-tap PermissionsAndroid request.
 *   - `disclosure`   — Play Store-mandated prominent disclosure (paired with the next step).
 *   - `final`        — last "All set!" screen with the optional blocking test.
 */
export type Step =
  | IllustrationStep
  | InstructionsStep
  | RuntimeStep
  | DisclosureStep
  | FinalStep;

/** Required for every step so the wizard can persist progress and skip it once granted. */
interface StepBase {
  id: string;
}

export interface IllustrationStep extends StepBase {
  kind: 'illustration';
  title: string;
  subtitle: string;
  illustration: IllustrationName;
  ctaLabel: string;
  /** Optional auto-advance check (e.g. a step that only exists to introduce the next one). */
  check?: () => Promise<boolean>;
  /**
   * Optional async action triggered by the CTA *before* advancing.
   * Used by the device-admin step to fire the activation intent.
   */
  onCtaAction?: () => Promise<void>;
}

export interface InstructionsStep extends StepBase {
  kind: 'instructions';
  title: string;
  subtitle: string;
  illustration?: IllustrationName;
  bullets: Array<{icon: string; text: string}>;
  ctaLabel: string;
  openSettings: () => Promise<void>;
  check: () => Promise<boolean>;
  /**
   * `true` for steps with no public read-back API (e.g. MIUI "Display pop-up" toggle, OEM
   * autostart). Tells the verification sheet that "Yes" can't be cross-checked, so we accept
   * the user's word without flagging it as a skipped requirement on the Final step.
   *
   * Default `false` — unverified positives are recorded as "skipped" and surfaced on the
   * Final step so the user has a chance to re-do the step before tapping Finish.
   */
  unverifiable?: boolean;
  /**
   * `true` for steps that are nice-to-have but won't block ChildNavigator from flipping to
   * Status (e.g. battery optimization, autostart). The Final step still warns if these are
   * missing but the user can proceed.
   *
   * Default `false` — the step is treated as required-for-Finish.
   */
  optional?: boolean;
}

export interface RuntimeStep extends StepBase {
  kind: 'runtime';
  title: string;
  subtitle: string;
  illustration: IllustrationName;
  /**
   * Either a single permission or an array (e.g. ACCESS_FINE_LOCATION + ACCESS_COARSE_LOCATION).
   * `null` means no PermissionsAndroid call is needed (e.g. notifications on Android <13).
   */
  permission: Permission | Permission[] | null;
  check: () => Promise<boolean>;
  rationale?: string;
}

export interface DisclosureStep extends StepBase {
  kind: 'disclosure';
  title: string;
  subtitle: string;
  body: string[];
  agreeLabel: string;
  /** id of the step paired with this disclosure (skipped together if user taps "Skip"). */
  pairsWithStepId: string;
}

export interface FinalStep extends StepBase {
  kind: 'final';
  title: string;
  subtitle: string;
  ctaLabel: string;
}
