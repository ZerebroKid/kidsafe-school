# `apps/guardian/src/screens/parent/`

The v1 parent dashboard, now isolated to ZConnect.

## Routes

`ParentNavigator` (`src/navigation/ParentNavigator.tsx`) renders this stack:

```
ParentTabs (bottom tabs)
├── Children      -> ChildrenListScreen
└── Settings      -> SettingsScreen

ChildDetails (push from Children list)
└── ChildDetailsScreen   (sub-tabs: Apps | Schedule | Location | Usage | PIN)

SharedProfileSetup       (one-time entry on shared-mode installs)
SharedPermissionsOnboard (OEM-aware wizard on shared-mode installs)
```

`ChildDetailsScreen` sub-tabs are *not* React Navigation tabs -- they're an
internal state machine (`const [tab, setTab] = useState<Tab>('apps')`) over the
5 tab components in this folder.

## Files

| File                                  | Purpose                                                            |
|---------------------------------------|--------------------------------------------------------------------|
| `ChildrenListScreen.tsx`              | List + add linked children, generate pairing code                  |
| `ChildDetailsScreen.tsx`              | Shell for the 5 inner tabs + tamper-attempt banner                 |
| `CurrentAppPill.tsx`                  | Live "child is using X" pill at the top of every tab               |
| `AppsTab.tsx`                         | Per-child app list with allow / block toggles                      |
| `ScheduleTab.tsx`                     | Daily window + allowed apps within window                          |
| `LocationTab.tsx`                     | `react-native-maps` view + location diagnostics banner             |
| `UsageTab.tsx`                        | 7-day usage chart from `usageDaily` subcollection                  |
| `UsageBarChart.tsx`                   | Pure-SVG bar chart used by UsageTab                                |
| `PinTab.tsx`                          | Trigger a remote PIN reset on the child device                     |
| `SettingsScreen.tsx`                  | Account, deviceMode, sign-out                                      |
| `SharedPermissionsOnboardingScreen.tsx` | Shared-mode parent wraps the child OnboardingWizard                |

## Migration status (Phase 1)

All 11 screens compile against `@zerebro/shared-firebase/{firestore,auth}`
and `@zerebro/shared-types`. The only Firestore docs they read or write
are: `users/{uid}`, `children/{uid}`, `children/{uid}/apps/*`,
`children/{uid}/events/*`, `children/{uid}/usageDaily/*` -- identical to v1.

`react-native-maps` is the lone heavy native dep that lives here (ZKid
explicitly does not depend on it).

## What disappears in P1.6

- `SharedPermissionsOnboardingScreen.tsx`
- `screens/shared/*` (the entire kiosk: `ChildMode`, `ExitPin`, `ForgotPin`,
  `ChildModeEnded`)
- the temporary `screens/child/onboarding/` copy that exists only so
  `SharedPermissionsOnboardingScreen` can reuse the wizard
- `navigation/ChildModeNavigator.tsx`
- `hooks/useChildModeActive.ts`
- `modules/native.ts` (no native modules link into ZConnect at runtime)
- `deviceMode` / `sharedProfile` from `UserDoc` and `_shared` child ids
  from `firestore/rules`

What remains is a pure parent-dashboard app that reads Firestore and shows
graphs / maps / tabs.
