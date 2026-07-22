# Firebase Callable API Contracts

> There is **no Swagger / OpenAPI** spec. The backend is **Firebase Callable Functions**
> (HTTPS callables). This document is the Input/Output contract inventory.
>
> **Region:** `asia-south1`  
> **Auth:** Firebase Auth ID token (Phone OTP). Roles enforced via `users/{uid}.roles[]`.  
> **Client helper:** `callFn<Input, Output>('functionName', payload)` from `packages/shared-firebase`.

**Source of truth in code:** `apps/functions/src/callable/**` and `apps/functions/src/lib/sharedTypes.ts`.  
If this doc disagrees with code, the code wins.

---

## How to call

```ts
await callFn<Input, Output>('assignTopic', { schoolId, classId, ... });
```

Many screens also **read Firestore directly** (`getDoc` / `onSnapshot`). Sensitive **writes** go through callables only.

### Error codes (`HttpsError`)

| Code | Meaning |
|------|---------|
| `unauthenticated` | Not signed in |
| `permission-denied` | Missing role or not allowed for this resource |
| `invalid-argument` | Bad / missing input |
| `not-found` | Doc does not exist |
| `failed-precondition` | Business rule blocked |
| `internal` | Unexpected failure — safe to retry |

---

## 1. Health

### `ping`

| | |
|--|--|
| **Role** | none (smoke test) |
| **Input** | `{}` |
| **Output** | health payload |

---

## 2. Principal onboarding

### `claimSchool`

| | |
|--|--|
| **Role** | authenticated |
| **Input** | `{ inviteCode: string; displayName: string; requestedGradeSections?: Record<string, number>; studentCount?: number }` |
| **Output** | `{ schoolId: string; principalId: string; status: 'pending' }` |

### `approvePrincipal`

| | |
|--|--|
| **Role** | `admin` |
| **Input** | `{ schoolId: string; principalId: string }` |
| **Output** | `{ ok: true }` |

### `rejectPrincipal`

| | |
|--|--|
| **Role** | `admin` |
| **Input** | `{ schoolId: string; principalId: string; reason: string }` |
| **Output** | `{ ok: true }` |

### `rotateInviteCode`

| | |
|--|--|
| **Role** | `admin` |
| **Input** | `{ schoolId: string }` |
| **Output** | `{ inviteCode: string }` |

---

## 3. Teacher onboarding

### `rotateTeacherCode`

| | |
|--|--|
| **Role** | `principal` |
| **Input** | `{ schoolId: string }` |
| **Output** | `{ teacherCode: string }` |

### `lookupSchoolClasses`

| | |
|--|--|
| **Role** | authenticated |
| **Input** | `{ teacherCode: string }` |
| **Output** | `{ schoolId: string; schoolName: string; classes: ClassSummary[]; curricula: CurriculumSummary[] }` |

```ts
interface ClassSummary {
  id: string;
  className: string;
  grade: number;
  section: string;
  subjectTeachers: Record<string, string>; // curriculumId -> teacherUid
}

interface CurriculumSummary {
  id: string;
  subject: string;
  grade: number;
  board: string;
}
```

### `requestTeacherJoin`

| | |
|--|--|
| **Role** | authenticated |
| **Input** | `{ teacherCode: string; displayName: string; classSubjects?: { classId: string; curriculumId: string }[]; classIds?: string[] }` |
| **Output** | `{ schoolId: string; teacherId: string; status: 'pending' }` |

> `classIds` is deprecated; prefer `classSubjects`.

### `approveTeacher`

| | |
|--|--|
| **Role** | `principal` |
| **Input** | `{ schoolId: string; teacherId: string }` |
| **Output** | `{ ok: true }` |

### `rejectTeacher`

| | |
|--|--|
| **Role** | `principal` |
| **Input** | `{ schoolId: string; teacherId: string; reason: string }` |
| **Output** | `{ ok: true }` |

---

## 4. Parent + child school link

### `joinSchoolAsParent`

| | |
|--|--|
| **Role** | authenticated |
| **Input** | `{ inviteCode: string; displayName: string }` |
| **Output** | `{ schoolId: string; alreadyJoined: boolean }` |

Idempotent. Grants `parent` role immediately (no approval gate).

### `joinSchool`

| | |
|--|--|
| **Role** | authenticated |
| **Input** | `{ inviteCode: string; grade: number; section: string }` |
| **Output** | `{ schoolId: string; classId: string; alreadyJoined: boolean }` |

Idempotent. Grants `child` role + links to class roster.

---

## 5. Grade management

### `requestGradeChange`

| | |
|--|--|
| **Role** | `principal` |
| **Input** | `{ schoolId: string; gradesToAdd?: number[]; gradesSections?: Record<string, number> }` |
| **Output** | `{ requestId: string; status: 'pending' }` |

> Prefer `gradesSections` (e.g. `{ "9": 2, "10": 3 }`). `gradesToAdd` is deprecated.

### `approveGradeChange`

| | |
|--|--|
| **Role** | `admin` |
| **Input** | `{ schoolId: string; requestId: string }` |
| **Output** | `{ ok: true }` |

### `rejectGradeChange`

| | |
|--|--|
| **Role** | `admin` |
| **Input** | `{ schoolId: string; requestId: string; reason: string }` |
| **Output** | `{ ok: true }` |

---

## 6. Study loop

### `assignTopic`

| | |
|--|--|
| **Role** | `teacher` |
| **Input** | `{ schoolId: string; classId: string; curriculumId: string; chapterId: string; topicId: string; dueAt: number }` |
| **Output** | `{ assignmentId: string; alreadyExisted: boolean }` |

`dueAt` = epoch ms UTC; must be roughly now … now + 30 days.

### `submitQuizAttempt`

| | |
|--|--|
| **Role** | `child` |
| **Input** | see below |
| **Output** | see below |

```ts
interface SubmitQuizAttemptInput {
  assignmentId: string;
  answers: { questionId: string; selectedIndex: number }[];
  mode?: 'mcq' | 'voice';
  voiceAnswers?: { questionId: string; transcript: string }[];
}

interface SubmitQuizAttemptOutput {
  attemptId: string;
  score: number;
  total: number;
  percentage: number;
  passed: boolean;
  firstPass: boolean;
  results: {
    questionId: string;
    selectedIndex: number;
    correctIndex: number;
    isCorrect: boolean;
    explanation?: string;
  }[];
}
```

Server is the source of truth for scoring. For `mode: 'voice'`, scores come from server-written `quizVoiceEvals` (via `zumiEvaluateAnswer`), not from client-supplied values.

---

## 7. Zumi voice

All require role `child` unless noted. Optional `audioUrl` on some responses is a ready-to-play TTS URL.

### Shared types

```ts
type ChatTurn = { role: 'user' | 'assistant'; content: string };
type TeachPhase =
  | 'warmup' | 'hook' | 'explore' | 'explain' | 'check' | 'ready_for_quiz';
type AnimationHint =
  | 'none' | 'experiment' | 'visualize' | 'reveal' | 'celebrate' | 'trap';
type EvalVerdict = 'correct' | 'partial' | 'incorrect';
```

### `zumiConverse`

| | |
|--|--|
| **Input** | `{ assignmentId: string; stage: 'greeting' \| 'closing'; history?: ChatTurn[]; scorePercent?: number }` |
| **Output** | `{ reply: string; audioUrl?: string }` |

### `zumiTeach`

| | |
|--|--|
| **Input** | `{ assignmentId: string; phase: TeachPhase; history?: ChatTurn[] }` |
| **Output** | `{ say: string; phase: TeachPhase; animationHint: AnimationHint; audioUrl?: string }` |

Phase progression is **server-driven**. Client reports the last returned phase; does not advance on its own.

### `zumiEvaluateAnswer`

| | |
|--|--|
| **Input** | `{ assignmentId: string; questionId: string; transcript: string }` |
| **Output** | `{ result: EvalVerdict; score: number; reasoning: string; feedback: string }` |

Persists verdict to `quizVoiceEvals/{assignmentId}_{uid}`.

### `zumiSpeak`

| | |
|--|--|
| **Input** | `{ text: string }` |
| **Output** | `{ url: string }` |

Returns Firebase Storage token URL for MP3 (cached by content hash).

### `zumiTranscribe`

| | |
|--|--|
| **Input** | `{ audioBase64?: string; mimeType?: string; storagePath?: string }` |
| **Output** | `{ transcript: string }` |

Prefer `audioBase64` (fast path). Max audio 5 MB. Default `mimeType`: `audio/mp4`.

### `zumiLiveKitToken`

| | |
|--|--|
| **Input** | `{ assignmentId: string }` |
| **Output** | `{ url: string; token: string; room: string }` |

LiveKit websocket URL + JWT scoped to room `zumi_{assignmentId}_{uid}`.

---

## 8. Billing (Razorpay)

### `createSubscription`

| | |
|--|--|
| **Role** | `principal` |
| **Input** | `{ schoolId: string }` |
| **Output** | `{ subscriptionId: string; shortUrl: string; amount: number; quantity: number; alreadyActive?: boolean }` |

### `getSubscriptionStatus`

| | |
|--|--|
| **Role** | `principal` |
| **Input** | `{ schoolId: string }` |
| **Output** | `{ exists: boolean; isActive: boolean; subscription: SubscriptionDoc \| null; graceRemainingHours: number \| null; studentCount: number \| null }` |

### `updateStudentCount`

| | |
|--|--|
| **Role** | `principal` |
| **Input** | `{ schoolId: string; newCount: number }` |
| **Output** | `{ newCount: number; effectiveFrom: 'next_cycle' \| 'immediate'; newMonthlyAmount: number }` |

### `cancelSubscription`

| | |
|--|--|
| **Role** | `principal` |
| **Input** | `{ schoolId: string; reason?: string }` |
| **Output** | `{ cancelled: boolean; alreadyCancelled?: boolean; cancelledAt: unknown }` |

### `adminActivateSubscription`

| | |
|--|--|
| **Role** | `admin` |
| **Input** | `{ schoolId: string; until: string \| number \| null }` |
| **Output** | `{ activated: boolean; deactivated: boolean; activatedUntil: unknown }` |

### `getPaymentHistory`

| | |
|--|--|
| **Role** | `principal` |
| **Input** | `{ schoolId: string; limit?: number; startAfter?: string }` |
| **Output** | `{ events: PaymentEvent[]; hasMore: boolean }` |

```ts
interface PaymentEvent {
  id: string;
  eventType: string;
  amount: number | null;
  razorpayPaymentId: string | null;
  processedAt: number | null;
  subscriptionId: string;
}
```

### `razorpayWebhook` (HTTP, not callable)

| | |
|--|--|
| **Method** | `POST` |
| **Path** | `/razorpayWebhook` |
| **Auth** | Razorpay signature header — **not for UI** |

---

## 9. Non-callable backend (for awareness)

| Name | Type | Behavior |
|------|------|----------|
| `onQuizAttemptWrite` | Firestore trigger | Unlocks reward on first pass → `rewardUnlocks` |
| `aggregateClassReports` | Cron (02:00 IST) | Nightly class report aggregates |

---

## Quick index

| Callable | Role |
|----------|------|
| `ping` | — |
| `claimSchool` | auth |
| `approvePrincipal` / `rejectPrincipal` | `admin` |
| `rotateInviteCode` | `admin` |
| `rotateTeacherCode` | `principal` |
| `lookupSchoolClasses` | auth |
| `requestTeacherJoin` | auth |
| `approveTeacher` / `rejectTeacher` | `principal` |
| `joinSchoolAsParent` | auth |
| `joinSchool` | auth |
| `requestGradeChange` | `principal` |
| `approveGradeChange` / `rejectGradeChange` | `admin` |
| `assignTopic` | `teacher` |
| `submitQuizAttempt` | `child` |
| `zumiConverse` / `zumiTeach` / `zumiEvaluateAnswer` / `zumiSpeak` / `zumiTranscribe` / `zumiLiveKitToken` | `child` |
| `createSubscription` / `getSubscriptionStatus` / `updateStudentCount` / `cancelSubscription` / `getPaymentHistory` | `principal` |
| `adminActivateSubscription` | `admin` |

**Code paths:** `apps/functions/src/index.ts` (exports) · `apps/functions/src/callable/` (contracts)

---

## Related docs (deeper detail)

| Doc | What you’ll find |
|-----|------------------|
| [`docs/DATA_MODEL.md`](./DATA_MODEL.md) | Full Firestore schema; **§13 Cloud Functions Map** (which callable reads/writes which collection) |
| [`docs/FIRESTORE_SCHEMA_EXPLAINED.md`](./FIRESTORE_SCHEMA_EXPLAINED.md) | Field-level schema shapes for UI reads |
| [`docs/EDUCATION_AI_TECH_SPEC.md`](./EDUCATION_AI_TECH_SPEC.md) | Education product architecture; **§9 Backend Function Inventory** |
| [`docs/V2_BUILD_PHASES.md`](./V2_BUILD_PHASES.md) | Per-callable acceptance criteria, validation rules, and edge cases (Phase 4+) |
| [`docs/ZUMI_AI_TECHNICAL_WALKTHROUGH.md`](./ZUMI_AI_TECHNICAL_WALKTHROUGH.md) | Zumi voice request/response detail, phases, TTS/STT paths |
| [`docs/ZUMI_AI_TECH_DESIGN.md`](./ZUMI_AI_TECH_DESIGN.md) | Zumi design decisions and architecture |
| [`docs/ZUMI_AI_OVERVIEW.md`](./ZUMI_AI_OVERVIEW.md) | High-level Zumi feature overview for product/UI context |
| [`docs/PAYMENT_ARCHITECTURE.md`](./PAYMENT_ARCHITECTURE.md) | Subscription flow; **§6** callable I/O + webhook events |
| [`docs/BEGINNER_APP_FLOW.md`](./BEGINNER_APP_FLOW.md) | End-to-end user journeys across apps |
| [`docs/SYSTEM_DESIGN_KT.md`](./SYSTEM_DESIGN_KT.md) | Parental-control / KidSafe system KT (non-education surfaces) |
| [`apps/functions/README.md`](../apps/functions/README.md) | Local emulator, deploy, secrets, region setup |

**Types in code:** `packages/shared-types/` (client-facing shapes) · `apps/functions/src/lib/sharedTypes.ts` (functions-local mirrors)
