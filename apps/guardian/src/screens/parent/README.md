# `apps/guardian/src/screens/parent/`

The v1 parent dashboard, now isolated to ZConnect.

## Routes

`ParentNavigator` (`src/navigation/ParentNavigator.tsx`) renders this stack:

```
ParentTabs (bottom tabs)
├── Children      -> ChildrenListScreen
└── Settings      -> SettingsScreen

ChildDetails (push from Children list)
└── ChildDetailsScreen   (sub-tabs: Apps | Schedule | Location | Study | Reels | PIN)
```

The v1 shared-mode routes (`SharedProfileSetup`, `SharedPermissionsOnboarding`)
were removed in P1.6.1.

`ChildDetailsScreen` sub-tabs are *not* React Navigation tabs -- they're an
internal state machine (`const [tab, setTab] = useState<Tab>('apps')`) over the
tab components in this folder.

## Files

| File                                  | Purpose                                                            |
|---------------------------------------|--------------------------------------------------------------------|
| `ChildrenListScreen.tsx`              | List linked children with lock toggle                              |
| `ChildDetailsScreen.tsx`              | Shell for the inner tabs + tamper-attempt banner                   |
| `CurrentAppPill.tsx`                  | Live "child is using X" pill at the top of every tab               |
| `AppsTab.tsx`                         | Per-child app list with allow / block toggles                      |
| `ScheduleTab.tsx`                     | Daily window + allowed apps within window                          |
| `LocationTab.tsx`                     | `react-native-maps` view + location diagnostics banner             |
| `PinTab.tsx`                          | Trigger a remote PIN reset on the child device                     |
| `SettingsScreen.tsx`                  | Pairing code (generate / share) + sign-out                         |

## Migration status (Phase 1)

All 11 screens compile against `@zerebro/shared-firebase/{firestore,auth}`
and `@zerebro/shared-types`. The only Firestore docs they read or write
are: `users/{uid}`, `children/{uid}`, `children/{uid}/apps/*`,
`children/{uid}/events/*`, `children/{uid}/usageDaily/*` -- identical to v1.

`react-native-maps` is the lone heavy native dep that lives here (ZKid
explicitly does not depend on it).

## P1.6.1 cleanup (done)

Deleted from `apps/guardian/`:

- `screens/parent/SharedPermissionsOnboardingScreen.tsx`
- `screens/shared/*` (the entire kiosk: `ChildMode`, `ExitPin`, `ForgotPin`,
  `ChildModeEnded`)
- `screens/child/onboarding/*` (the wizard copy that only existed for
  `SharedPermissionsOnboardingScreen`)
- `screens/auth/SharedProfileSetupScreen.tsx`
- `screens/auth/RoleSelectorScreen.tsx` (replaced by `initialParams={{role:
  'parent'}}` on the Signup screen)
- `navigation/ChildModeNavigator.tsx`
- `hooks/useChildModeActive.ts`
- `modules/native.ts` (zero native modules link into ZConnect at runtime)
- `utils/oem.ts` (only used by the deleted OEM-aware wizard)

The remaining `deviceMode`-aware code paths in `SettingsScreen` and
`ChildrenListScreen` were rewritten to be two-device only; the legacy
`UserDoc.deviceMode` and `UserDoc.sharedProfile` fields are still present
in `@zerebro/shared-types` (marked deprecated) so any in-flight v1 docs
keep deserializing -- a follow-up will retire them once we're sure no v1
data survives.
