/**
 * P4.2.9 -- seed Demo School + Demo Admin + Demo Principal + classes +
 * subjects for fast iteration on Phase 4 features.
 *
 * Idempotent. Re-running a successful seed is a no-op (skips existing docs
 * + users instead of erroring). Designed for the emulator by default; you
 * CAN run it against prod with `--target=prod --apply` but think twice --
 * it creates real phone-OTP-style auth users at +91 9999 90000{1,2}.
 *
 * Usage (from monorepo root):
 *   pnpm seed:staging                       # dry-run, emulator
 *   pnpm seed:staging -- --apply            # commit, emulator
 *   pnpm seed:staging -- --apply --target=prod   # commit to prod (careful)
 *
 * What it creates:
 *   - users/<demoAdminUid>   roles=['admin'],     primaryRole='admin'
 *   - users/<demoPrincipalUid> roles=['principal'], primaryRole='principal'
 *   - schools/demo_school_001 (inviteCode=DEMO2026, principalUid=demoPrincipalUid)
 *   - schools/demo_school_001/classes/{8a,8b}
 *   - schools/demo_school_001/classes/{8a,8b}/subjects/{science,maths,english}
 */

import {FieldValue} from 'firebase-admin/firestore';
import {initScriptAdmin, parseBaseFlags} from './lib/scriptInit';

const DEMO_ADMIN_PHONE = '+919999900001';
const DEMO_ADMIN_NAME = 'Demo Admin';
const DEMO_PRINCIPAL_PHONE = '+919999900002';
const DEMO_PRINCIPAL_NAME = 'Demo Principal';
// P4.3 -- third demo user is a TEACHER whose join request is already pending.
// roles=[] on the user doc so ZConnect's RoleOnboardingGate routes them to
// the intent picker on first sign-in; the pending teacher subcollection doc
// then drives the "Waiting for principal approval" screen via the
// collectionGroup('teachers') listener.
const DEMO_TEACHER_PHONE = '+919999900003';
const DEMO_TEACHER_NAME = 'Demo Teacher';

const DEMO_SCHOOL_ID = 'demo_school_001';
const DEMO_SCHOOL_NAME = 'Demo Public School';
const DEMO_SCHOOL_CITY = 'Mumbai';
const DEMO_INVITE_CODE = 'DEMO2026';
// teacherCode mirrors the shape rotateTeacherCode would emit (6-char,
// A-Z+2-9 minus ambiguous chars). Hard-coded for predictable manual demos
// -- a real principal would rotate this to randomise it before sharing.
const DEMO_TEACHER_CODE = 'TEACH7';

const CLASSES: Array<{
  id: string;
  grade: number;
  section: string;
  className: string;
}> = [
  {id: '8a', grade: 8, section: 'A', className: '8A'},
  {id: '8b', grade: 8, section: 'B', className: '8B'},
];

const SUBJECTS: Array<{
  id: string;
  name: string;
  code: string;
  curriculumId: string;
}> = [
  {id: 'science', name: 'Science', code: 'SCI', curriculumId: 'cbse_8_science'},
  {id: 'maths', name: 'Maths', code: 'MAT', curriculumId: 'cbse_8_maths'},
  {id: 'english', name: 'English', code: 'ENG', curriculumId: 'cbse_8_english'},
];

async function main(): Promise<void> {
  const flags = parseBaseFlags(process.argv.slice(2));
  const {db, auth} = initScriptAdmin(flags);

  console.log(`[start] mode=${flags.apply ? 'APPLY' : 'DRY-RUN'} target=${flags.target}`);

  if (flags.target === 'prod' && flags.apply) {
    console.log('[apply] WAITING 5s before prod writes -- Ctrl-C to abort');
    await new Promise(r => setTimeout(r, 5000));
  }

  const adminUid = await ensureUser(
    auth,
    DEMO_ADMIN_PHONE,
    DEMO_ADMIN_NAME,
    flags.apply,
  );
  const principalUid = await ensureUser(
    auth,
    DEMO_PRINCIPAL_PHONE,
    DEMO_PRINCIPAL_NAME,
    flags.apply,
  );
  const teacherUid = await ensureUser(
    auth,
    DEMO_TEACHER_PHONE,
    DEMO_TEACHER_NAME,
    flags.apply,
  );

  await ensureUserDoc(db, adminUid, DEMO_ADMIN_PHONE, 'admin', flags.apply);
  await ensureUserDoc(
    db,
    principalUid,
    DEMO_PRINCIPAL_PHONE,
    'principal',
    flags.apply,
  );
  // Demo teacher: roles=[] is the whole point -- ZConnect treats this user as
  // an unroled phone-OTP signup so the role-intent picker is reachable. We
  // therefore use a separate helper that ARRAY-UNIONS into an empty roles[]
  // (preserving any role a previous seed run granted in case the operator
  // also approved them).
  await ensureUnroledUserDoc(db, teacherUid, DEMO_TEACHER_PHONE, flags.apply);

  const schoolRef = db.collection('schools').doc(DEMO_SCHOOL_ID);
  const schoolSnap = await schoolRef.get();
  if (!schoolSnap.exists) {
    console.log(`[plan] schools/${DEMO_SCHOOL_ID} (create)`);
    if (flags.apply) {
      await schoolRef.set({
        name: DEMO_SCHOOL_NAME,
        city: DEMO_SCHOOL_CITY,
        inviteCode: DEMO_INVITE_CODE,
        teacherCode: DEMO_TEACHER_CODE,
        principalUid,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
  } else {
    // School exists; patch in any missing fields without clobbering operator
    // edits (e.g. a real rotated teacherCode).
    const data = schoolSnap.data() ?? {};
    const patch: Record<string, unknown> = {};
    if (!data.principalUid) patch.principalUid = principalUid;
    if (typeof data.teacherCode !== 'string' || data.teacherCode.length === 0) {
      patch.teacherCode = DEMO_TEACHER_CODE;
    }
    if (Object.keys(patch).length > 0) {
      console.log(
        `[plan] schools/${DEMO_SCHOOL_ID} (patch ${Object.keys(patch).join('+')})`,
      );
      if (flags.apply) await schoolRef.update(patch);
    } else {
      console.log(`[skip] schools/${DEMO_SCHOOL_ID} already seeded`);
    }
  }

  // Pending teacher request: schools/{DEMO_SCHOOL_ID}/teachers/{teacherUid}.
  // doc id == userId so the same shape used by `requestTeacherJoin` (P4.3).
  // Re-running the seed is a no-op once this doc exists -- we don't blat a
  // status='active' back to 'pending' if the operator approved the demo
  // teacher between runs.
  const teacherRef = schoolRef.collection('teachers').doc(teacherUid);
  const teacherSnap = await teacherRef.get();
  if (!teacherSnap.exists) {
    console.log(
      `[plan] schools/${DEMO_SCHOOL_ID}/teachers/${teacherUid} (create pending)`,
    );
    if (flags.apply) {
      await teacherRef.set({
        userId: teacherUid,
        displayName: DEMO_TEACHER_NAME,
        phone: DEMO_TEACHER_PHONE,
        status: 'pending',
        requestedAt: FieldValue.serverTimestamp(),
      });
    }
  } else {
    console.log(
      `[skip] schools/${DEMO_SCHOOL_ID}/teachers/${teacherUid} already seeded (status=${teacherSnap.data()?.status})`,
    );
  }

  for (const k of CLASSES) {
    const classRef = schoolRef.collection('classes').doc(k.id);
    const classSnap = await classRef.get();
    if (!classSnap.exists) {
      console.log(`[plan] schools/${DEMO_SCHOOL_ID}/classes/${k.id} (create)`);
      if (flags.apply) {
        await classRef.set({
          grade: k.grade,
          section: k.section,
          className: k.className,
          academicYear: '2026-27',
          teacherIds: [],
          studentChildUids: [],
          createdAt: FieldValue.serverTimestamp(),
        });
      }
    } else {
      console.log(`[skip] schools/${DEMO_SCHOOL_ID}/classes/${k.id} already seeded`);
    }

    for (const s of SUBJECTS) {
      const subjectRef = classRef.collection('subjects').doc(s.id);
      const subjectSnap = await subjectRef.get();
      if (!subjectSnap.exists) {
        console.log(
          `[plan] schools/${DEMO_SCHOOL_ID}/classes/${k.id}/subjects/${s.id} (create)`,
        );
        if (flags.apply) {
          await subjectRef.set({
            name: s.name,
            code: s.code,
            curriculumId: s.curriculumId,
            teacherIds: [],
          });
        }
      }
    }
  }

  console.log('[done]', flags.apply ? 'applied' : 'dry-run (re-run with --apply)');
}

async function ensureUser(
  auth: ReturnType<typeof initScriptAdmin>['auth'],
  phone: string,
  displayName: string,
  apply: boolean,
): Promise<string> {
  try {
    const existing = await auth.getUserByPhoneNumber(phone);
    console.log(`[skip] auth user ${phone} already exists uid=${existing.uid}`);
    return existing.uid;
  } catch {
    console.log(`[plan] auth user ${phone} (create displayName="${displayName}")`);
    if (!apply) {
      // Return a fake uid for the dry-run so downstream user-doc plans render
      // a recognisable id; nothing gets written.
      return `DRYRUN_${phone.replace(/[^0-9]/g, '')}`;
    }
    const created = await auth.createUser({phoneNumber: phone, displayName});
    return created.uid;
  }
}

/**
 * Bootstrap a user doc that is INTENTIONALLY unroled (roles=[]). Used for the
 * demo teacher whose role grant lands later via `approveTeacher`. Idempotent
 * against an already-approved user: if `roles[]` is non-empty we leave it
 * alone (don't reset a real grant to []).
 */
async function ensureUnroledUserDoc(
  db: ReturnType<typeof initScriptAdmin>['db'],
  uid: string,
  phone: string,
  apply: boolean,
): Promise<void> {
  const ref = db.collection('users').doc(uid);
  const snap = await ref.get();
  if (snap.exists) {
    const data = snap.data() ?? {};
    const roles: string[] = Array.isArray(data.roles)
      ? data.roles.filter((r: unknown): r is string => typeof r === 'string')
      : [];
    if (roles.length > 0) {
      console.log(
        `[skip] users/${uid} already has roles=[${roles.join(',')}] -- preserving`,
      );
      return;
    }
    console.log(`[skip] users/${uid} already exists with roles=[]`);
    return;
  }
  console.log(`[plan] users/${uid} (create unroled: roles=[], phone)`);
  if (!apply) return;
  await ref.set({
    phone,
    roles: [],
    createdAt: FieldValue.serverTimestamp(),
  });
}

async function ensureUserDoc(
  db: ReturnType<typeof initScriptAdmin>['db'],
  uid: string,
  phone: string,
  role: 'admin' | 'principal',
  apply: boolean,
): Promise<void> {
  const ref = db.collection('users').doc(uid);
  const snap = await ref.get();
  const data = snap.exists ? snap.data() ?? {} : {};
  const roles: string[] = Array.isArray(data.roles)
    ? data.roles.filter((r: unknown): r is string => typeof r === 'string')
    : [];
  if (roles.includes(role) && data.primaryRole === role) {
    console.log(`[skip] users/${uid} already has role=${role}`);
    return;
  }
  console.log(`[plan] users/${uid} (set phone + roles+=${role} + primaryRole=${role})`);
  if (!apply) return;
  await ref.set(
    {
      phone,
      roles: FieldValue.arrayUnion(role),
      primaryRole: role,
      createdAt: snap.exists ? data.createdAt ?? FieldValue.serverTimestamp() : FieldValue.serverTimestamp(),
    },
    {merge: true},
  );
}

main().catch(err => {
  console.error('[fatal]', err);
  process.exit(1);
});
