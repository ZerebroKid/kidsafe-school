# Payment Architecture — Razorpay Subscription for Zerebro Campus

> **Status:** Locked  
> **Provider:** Razorpay (India — UPI, cards, net banking, recurring e-mandate)  
> **Billing model:** ₹99/student/month, manual student count entry, auto-recurring charge  
> **Gating:** Hard block — zero features accessible without active subscription

---

## 1) Business Rules

| Rule | Value |
|------|-------|
| Price per student | ₹99/month |
| Billing cycle | Monthly (auto-recurring via Razorpay) |
| Student count source | Principal enters during onboarding (not auto-counted from rosters) |
| Example | 200 students × ₹99 = ₹19,800/month |
| Grace period | 2 days after payment failure |
| Trial period | None (0 days) |
| What stays free | Nothing — full hard block on all features |
| Admin override | Yes — admin can manually activate a school with an expiry date |
| Quantity update | Principal can change student count; takes effect next billing cycle |

---

## 2) How Razorpay Subscriptions Work

```
Razorpay Concepts:
┌──────────┐     ┌──────────────┐     ┌──────────────┐
│   Plan   │────▶│ Subscription │────▶│   Invoices   │
│ (template│     │ (per school) │     │ (auto-gen    │
│  ₹99/unit│     │ quantity = N │     │  each cycle) │
│  monthly)│     │              │     │              │
└──────────┘     └──────────────┘     └──────────────┘
                        │
                        ▼
                  Total charge = Plan amount × quantity
                  = ₹99 × N students
```

**Key API parameters:**
- `plan.amount`: 9900 (paise = ₹99)
- `plan.period`: "monthly"
- `subscription.quantity`: student count
- `subscription.total_count`: 1200 (100 years max — effectively indefinite)

---

## 3) Subscription Lifecycle

```
Principal Signs Up (Phone OTP)
        │
        ▼
Onboarding Page
  - Enter school invite code ✓ (existing)
  - Select grades/sections ✓ (existing)
  - Enter total number of students ← NEW
        │
        ▼
Admin approves principal (existing flow)
        │
        ▼
Principal lands on /subscription (NOT dashboard)
  - Sees: "150 students × ₹99 = ₹14,850/month"
  - Clicks [Subscribe Now]
        │
        ▼
Backend creates Razorpay Subscription
  - Returns subscription_id
        │
        ▼
Razorpay Checkout modal opens
  - Principal authorizes payment (card/UPI/etc.)
        │
        ▼
Razorpay webhook: subscription.activated
        │
        ▼
Features unlocked — principal sees full dashboard
        │
        ▼
Monthly cycle:
  ┌─────────────────────────────────────────┐
  │ charge_at reached → Razorpay auto-debits│
  │         │                               │
  │    ┌────┴─────┐                         │
  │    │          │                         │
  │ SUCCESS    FAILURE                      │
  │    │          │                         │
  │ Webhook:   Webhook:                     │
  │ sub.charged sub.pending                 │
  │    │          │                         │
  │ Extend     Start 2-day                  │
  │ period     grace timer                  │
  │    │          │                         │
  │ Features   ┌──┴───┐                    │
  │ remain     │      │                    │
  │ unlocked   Pays   Doesn't pay          │
  │            within  within 2 days        │
  │            2 days     │                 │
  │              │     Webhook:             │
  │           Unlocked sub.halted           │
  │              │        │                 │
  │              │     FULL BLOCK           │
  │              │     Only /subscription   │
  │              │     page accessible      │
  └─────────────────────────────────────────┘
```

---

## 4) Feature Gating Strategy

**Hard block** — when subscription is not active, the principal sees ONLY the `/subscription` page. Every other route redirects there.

```
Request to any (dashboard) route
        │
        ▼
Check subscription status
        │
  ┌─────┴──────────┐
  │                 │
ACTIVE           NOT ACTIVE
  │                 │
  ▼                 ▼
Normal page      Redirect to /subscription
rendering        (paywall + "Subscribe" or "Renew" CTA)
```

**"Active" means any of:**
1. `status === 'active'`
2. `status === 'pending'` AND within 2-day grace window
3. `manuallyActivated === true` AND `manuallyActivatedUntil > now`

Everything else = blocked.

---

## 5) Firestore Schema

### 5.1 Modified: `schools/{schoolId}`

```typescript
interface SchoolDoc {
  // ... all existing fields unchanged ...
  studentCount: number;  // NEW — entered by principal during onboarding
}
```

### 5.2 New: `schools/{schoolId}/subscription` (single document)

```typescript
interface SubscriptionDoc {
  // Razorpay references
  razorpaySubscriptionId: string;
  razorpayCustomerId: string;
  razorpayPlanId: string;

  // Subscription state (mirrors Razorpay status)
  status: 'created' | 'authenticated' | 'active' | 'pending'
        | 'halted' | 'cancelled' | 'completed' | 'expired';
  quantity: number;            // = studentCount at time of creation/update
  amountPerStudent: number;    // 9900 (paise)
  totalAmount: number;         // quantity × amountPerStudent

  // Current billing cycle
  currentPeriodStart: Timestamp;
  currentPeriodEnd: Timestamp;
  nextChargeAt: Timestamp;
  lastChargeFailedAt: Timestamp | null;  // for 2-day grace calculation

  // Admin override
  manuallyActivated: boolean;
  manuallyActivatedBy: string | null;     // admin UID
  manuallyActivatedUntil: Timestamp | null;

  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
  cancelledAt: Timestamp | null;
}
```

### 5.3 New: `paymentEvents/{eventId}` (append-only log)

```typescript
interface PaymentEventDoc {
  schoolId: string;
  subscriptionId: string;
  razorpayEventId: string;
  eventType: string;            // e.g. "subscription.charged"
  razorpayPaymentId: string | null;
  amount: number | null;
  payload: Record<string, any>; // raw webhook body
  processedAt: Timestamp;
}
```

### 5.4 Security Rules

```
// Server-only writes — no client can write to these
match /schools/{schoolId}/subscription {
  allow read: if isOwnerPrincipal(schoolId) || isAdmin();
  allow write: if false;  // only Cloud Functions write here
}

match /paymentEvents/{eventId} {
  allow read: if isAdmin();
  allow write: if false;  // only webhook handler writes here
}
```

---

## 6) API Design (Cloud Functions)

### 6.1 Callables

| Callable | Role Required | Input | Output | Description |
|----------|--------------|-------|--------|-------------|
| `createSubscription` | `principal` | `{ schoolId }` | `{ subscriptionId, shortUrl, amount }` | Creates Razorpay subscription using school's studentCount |
| `getSubscriptionStatus` | `principal` | `{ schoolId }` | `SubscriptionDoc` | Returns current subscription state |
| `updateStudentCount` | `principal` | `{ schoolId, newCount }` | `{ effectiveFrom, newAmount }` | Updates quantity for next billing cycle |
| `cancelSubscription` | `principal` | `{ schoolId, reason? }` | `{ cancelledAt }` | Cancels subscription (immediate block) |
| `adminActivateSubscription` | `admin` | `{ schoolId, until }` | `{ activatedUntil }` | Manual override activation with expiry |
| `adminDeactivateSubscription` | `admin` | `{ schoolId }` | `{}` | Remove manual override |

### 6.2 HTTP Function (Webhook)

| Function | Method | Path | Auth |
|----------|--------|------|------|
| `razorpayWebhook` | POST | `/razorpayWebhook` | Razorpay signature (X-Razorpay-Signature header) |

---

## 7) Webhook Event Handling

| Razorpay Event | Action in Firestore | Feature Access |
|----------------|--------------------|-|
| `subscription.authenticated` | Set status → `authenticated` | Blocked (awaiting first charge) |
| `subscription.activated` | Set status → `active`, set period dates | **Unlocked** |
| `subscription.charged` | Set status → `active`, extend period, log payment | **Unlocked** |
| `subscription.pending` | Set status → `pending`, set `lastChargeFailedAt` | Unlocked (2-day grace) |
| `subscription.halted` | Set status → `halted` | **Blocked** |
| `subscription.cancelled` | Set status → `cancelled`, set `cancelledAt` | **Blocked** |
| `subscription.paused` | Set status → `halted` | **Blocked** |
| `subscription.resumed` | Set status → `active` | **Unlocked** |

### Webhook Signature Verification

```typescript
import crypto from 'crypto';

function verifyRazorpayWebhook(rawBody: string, signature: string, secret: string): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
```

### Idempotency

Webhooks can be delivered multiple times. Before processing:
1. Check if `razorpayEventId` already exists in `paymentEvents`
2. If yes, skip processing (return 200 OK)
3. If no, process and log

---

## 8) Frontend Integration

### 8.1 Razorpay Checkout (Client-Side)

Load the Razorpay checkout script in `principal-web`:

```html
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
```

Checkout options:

```typescript
const options = {
  key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
  subscription_id: subscriptionId,  // from createSubscription callable
  name: "Zerebro Campus",
  description: `School Subscription — ${studentCount} students`,
  handler: function (response) {
    // response.razorpay_payment_id
    // response.razorpay_subscription_id
    // response.razorpay_signature
    // Verify on server or wait for webhook to update status
  },
  theme: { color: "#4F46E5" },
};

const rzp = new window.Razorpay(options);
rzp.open();
```

### 8.2 New Routes in Principal Web

| Route | Page | Purpose |
|-------|------|---------|
| `/subscription` | SubscriptionPage | Show status, amount, pay/renew button |
| `/subscription/history` | PaymentHistoryPage | List past payments/invoices |

### 8.3 Modified Routes

| Route | Change |
|-------|--------|
| `/onboarding` | Add `studentCount` number input field |
| `(dashboard)/layout.tsx` | Add subscription gate (redirect to `/subscription` if not active) |

---

## 9) Admin Override (Zerebro Admin)

Admins can force-activate a school's subscription (for demos, offline payments, special deals):

- **UI:** Button on school detail page: "Activate Subscription" + date picker for expiry
- **Callable:** `adminActivateSubscription({ schoolId, until: Timestamp })`
- **Effect:** Sets `manuallyActivated: true` + `manuallyActivatedUntil` on the subscription doc
- **Gate logic:** If `manuallyActivated && until > now` → treat as active regardless of Razorpay status

---

## 10) Environment Variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `RAZORPAY_KEY_ID` | Cloud Functions (secret) | API authentication |
| `RAZORPAY_KEY_SECRET` | Cloud Functions (secret) | API authentication |
| `RAZORPAY_WEBHOOK_SECRET` | Cloud Functions (secret) | Webhook signature verification |
| `RAZORPAY_PLAN_ID` | Cloud Functions (config) | The single plan ID (created once) |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Principal Web (.env) | Checkout script (public key only) |

---

## 11) File Structure (New/Modified)

```
apps/functions/src/
├── callable/subscription/
│   ├── createSubscription.ts
│   ├── getSubscriptionStatus.ts
│   ├── updateStudentCount.ts
│   ├── cancelSubscription.ts
│   └── adminActivateSubscription.ts
├── http/
│   └── razorpayWebhook.ts
├── lib/
│   └── razorpay.ts                    ← SDK instance + helpers
└── index.ts                           ← export new callables + http fn

packages/shared-types/src/
├── subscription.ts                    ← SubscriptionDoc, PaymentEventDoc
└── index.ts                           ← re-export

apps/principal-web/src/
├── app/
│   ├── onboarding/page.tsx            ← MODIFY (add studentCount field)
│   └── (dashboard)/
│       ├── layout.tsx                 ← MODIFY (add subscription gate)
│       └── subscription/
│           ├── page.tsx               ← NEW (subscribe/renew page)
│           └── history/page.tsx       ← NEW (payment history)
└── components/
    └── SubscriptionBanner.tsx         ← NEW (warning banner during grace)

apps/admin-web/src/app/
└── schools/[id]/page.tsx              ← MODIFY (add override controls)

firestore/rules                        ← MODIFY (add subscription rules)
```

---

## 12) Dependencies

| Package | Location | Purpose |
|---------|----------|---------|
| `razorpay` (npm, latest) | `apps/functions/package.json` | Server-side Razorpay SDK |
| Checkout.js (CDN) | `apps/principal-web` | Client-side payment modal |

No new packages needed for principal-web or admin-web beyond what's already installed.

---

## 13) Implementation Phases

| Phase | Scope | Depends on |
|-------|-------|-----------|
| **P1: Types & Schema** | Add `SubscriptionDoc`, `PaymentEventDoc` types, update `SchoolDoc`, update Firestore rules | Nothing |
| **P2: Razorpay Setup** | Create plan via API/dashboard, store plan ID in config, add `razorpay` package to functions | P1 |
| **P3: Callables** | `createSubscription`, `getSubscriptionStatus`, `cancelSubscription`, `updateStudentCount`, `adminActivateSubscription` | P2 |
| **P4: Webhook** | `razorpayWebhook` HTTP function — signature verification, event processing, Firestore updates | P3 |
| **P5: Onboarding Update** | Add `studentCount` field to onboarding page, update `claimSchool` callable | P1 |
| **P6: Subscription Page** | `/subscription` route — display amount, checkout integration, status display | P3 |
| **P7: Feature Gate** | Update `(dashboard)/layout.tsx` to enforce subscription check | P4, P6 |
| **P8: Admin Override** | Add activation controls to admin school detail page | P3 |
| **P9: Payment History** | `/subscription/history` — list past invoices from `paymentEvents` | P4 |

---

## 14) Testing Strategy

- **Test mode:** Use Razorpay test keys (`rzp_test_*`) during development
- **Emulator:** Webhook handler testable via `curl` to local functions emulator
- **Webhook simulation:** Razorpay dashboard → Webhooks → "Send Test Webhook"
- **Edge cases to test:**
  - First payment success → features unlock
  - Payment failure → 2-day grace → block
  - Payment retry during grace → re-unlock
  - Student count update → next cycle amount changes
  - Admin override → features unlock regardless of Razorpay status
  - Admin override expiry → falls back to Razorpay status
  - Duplicate webhook delivery → idempotent (no double processing)
  - Cancel → immediate block
  - Re-subscribe after cancel → new subscription created

---

## 15) Razorpay Dashboard Setup (One-Time)

1. Create account at `dashboard.razorpay.com`
2. Enable Subscriptions feature (Settings → Product Configuration)
3. Generate API keys (Settings → API Keys)
4. Create webhook endpoint (Settings → Webhooks)
   - URL: `https://asia-south1-kidsafe-e5eac.cloudfunctions.net/razorpayWebhook`
   - Events: All subscription events
   - Secret: Store as `RAZORPAY_WEBHOOK_SECRET`
5. Create Plan via API (or use `createPlan` one-off script):
   - Period: monthly
   - Interval: 1
   - Amount: 9900 (₹99 in paise)
   - Currency: INR
   - Item name: "Zerebro Campus — Per Student"
