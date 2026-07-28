# ZerebroKid mobile UI integration

This repository is the production source of truth. The older Expo prototype
was useful for validating visual direction, but new mobile work must land in
this monorepo so it shares Firebase authentication, Firestore rules, native
safety services, and Cloud Functions.

## Product boundaries

| Experience | Production app | Account role | Data source |
| --- | --- | --- | --- |
| Student | `apps/kids` (ZKid) | `child` | `studyAssignments`, curriculum and quiz documents |
| Junior | `apps/kids` (ZKid) | `child`, grade 6 or below | The same assignments plus Zumi and reels services |
| Parent | `apps/guardian` (ZConnect) | `parent` | Linked child, safety, schedule, usage and study documents |
| Teacher | `apps/guardian` (ZConnect) | `teacher` | School, class, curriculum and assignment data |
| Principal | `apps/principal-web` | `principal` | School administration data |

The role is resolved from `users/{uid}.primaryRole`; do not add a client-side
role picker to the signed-in production flow. ZConnect already supports an
approved parent/teacher role switcher. ZKid rejects non-child accounts.

## Implemented foundation

- `StudentHomeScreen` is the ZKid landing screen.
- It subscribes to today’s `studyAssignments` for the signed-in child’s class.
- Topic rows are never static: teacher assignments update the screen live.
- The call to action opens the existing lesson, topic and quiz stack.
- `FocusScreen` displays the live parent-managed schedule without giving the
  child a route to alter that schedule.
- `ProfileScreen` reads the signed-in child’s display name and `photoURL` from
  their authenticated user document.
- ZKid’s pairing, school-link, permission and native safety gates stay intact.

## Integration contracts

### Student learning

Teachers call `assignTopic`; this writes an active `studyAssignments` document.
ZKid reads it through `useTodayAssignments`. A UI change must keep the
assignment fields (`classId`, `curriculumId`, `chapterId`, `topicId`, `dueAt`
and `status`) intact so the existing Topic and Quiz screens continue to work.

### AI tutor

The repository already has production Zumi Cloud Functions for the junior
experience. A standard student tutor must only be added after its callable
contract has been agreed with the backend team. Do not place an API key in a
React Native app or create a fake client-side chat endpoint.

### Profile photos and names

The authenticated name comes from `users/{uid}.displayName` and the profile
photo field is `users/{uid}.photoURL`. Add device gallery upload only with a
Storage path, ownership rule and image resizing decision approved by the
backend team.

### Languages

Language preference should be stored as a user-profile preference after the
backend confirms the field and supported locale strategy. UI labels must not
claim translation support until content, tutor responses and curriculum are
available in that locale.

## Development workflow

1. Create a focused branch from `main`.
2. Make one screen or data-contract change at a time.
3. Run the affected app’s typecheck and Android build before review.
4. Commit a small, descriptive change.
5. Open a pull request; do not merge visual work with Firestore rule changes
   unless the review explicitly covers both.

## Next production slices

1. Refine ZKid student tabs: Learn, Focus, Tutor and Me, using agreed backend
   contracts for focus and tutor data.
2. Refine the existing Zumi/Juniors journey without bypassing assignment data.
3. Restyle ZConnect Parent child details around the live Schedule, Location,
   Usage and Study tabs already present.
4. Restyle ZConnect Teacher home and assignment workflow while preserving the
   `assignTopic` callable and class-report navigation.
