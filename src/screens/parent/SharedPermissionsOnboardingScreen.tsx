import React from 'react';

import {OnboardingWizard} from '../child/onboarding/OnboardingWizard';
import {useAuthStore} from '../../state/authStore';

/**
 * Shared-phone permissions setup. Reuses the same OEM-aware OnboardingWizard the child app
 * runs on a two-device install — same OEM detection, same accessibility / overlay / usage
 * / device admin steps, same PIN setup, same FinalStep audit + foreground service start.
 *
 * The only difference is `childUidOverride`: we point everything at the shared profile uid
 * (`${parentUid}_shared`) instead of the parent's Firebase auth uid, so the foreground
 * service binds to the profile that hosts the apps / usage / schedule data.
 *
 * `ParentNavigator` swaps this screen out for the regular ParentTabs as soon as the
 * permission audit passes and the foreground service is running — same gate the
 * `ChildNavigator` uses, just driven by `useSharedPermissionGate` here.
 */
export function SharedPermissionsOnboardingScreen() {
  const parentUid = useAuthStore(s => s.firebaseUid);
  const sharedChildUid = useAuthStore(s => s.userDoc?.sharedProfile?.childUid);
  return <OnboardingWizard childUidOverride={sharedChildUid ?? `${parentUid}_shared`} />;
}
