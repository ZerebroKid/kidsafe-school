import React from 'react';

import {OnboardingWizard} from './onboarding/OnboardingWizard';

/**
 * The child-side permissions onboarding flow. Delegates to the OEM-aware wizard which renders
 * one step at a time with deep links into the right system settings page per OEM. See
 * `./onboarding/OnboardingWizard.tsx` for the controller and `./onboarding/steps/*` for the
 * per-OEM step lists.
 *
 * `ChildNavigator` swaps this out for `StatusScreen` automatically once the foreground service
 * is running and all gated permissions are granted, so this component does not navigate
 * anywhere itself.
 */
export function PermissionsOnboardingScreen() {
  return <OnboardingWizard />;
}
