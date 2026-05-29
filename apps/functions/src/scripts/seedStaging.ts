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
 *   - users/<demoAdminUid>     roles=['admin'],     primaryRole='admin'
 *   - users/<demoPrincipalUid> roles=['principal'], primaryRole='principal'
 *   - users/<demoTeacherUid>   roles=[]               (P4.3 unroled)
 *   - users/<demoParentUid>    roles=[]               (P4.4 unroled)
 *   - users/<demoChildUid>     roles=['child'], parentUid=<demoParentUid>,
 *                              schoolIds missing       (P4.4 pre-paired, awaiting SchoolStep)
 *   - schools/demo_school_001  (inviteCode=DEMO2026, principalUid=demoPrincipalUid)
 *   - schools/demo_school_001/classes/{8a,8b}
 *   - schools/demo_school_001/classes/{8a,8b}/subjects/{science,maths,english}
 *   - schools/demo_school_001/teachers/<demoTeacherUid> status='pending' (P4.3)
 */

import * as path from 'path';

import {FieldValue} from 'firebase-admin/firestore';
import {initScriptAdmin, parseBaseFlags} from './lib/scriptInit';
import {importBundle, resolveBundles} from './importCurriculum';

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
// P4.4 -- fourth demo user is a PARENT who hasn't joined a school yet. The
// roles=[] shape mirrors what a fresh phone-OTP signup looks like before
// `joinSchoolAsParent` runs, so ZConnect's intent picker is reachable on
// first sign-in. The script does NOT pre-create a parents/{uid} doc; that's
// what we want QA to exercise via the JoinSchoolScreen.
const DEMO_PARENT_PHONE = '+919999900004';
const DEMO_PARENT_NAME = 'Demo Parent';
// P4.4 -- demo child is EMAIL-signed-up (ZKid stays on email/password in
// this phase) and pre-paired to the demo parent so QA can exercise
// SchoolStep directly without first running the pairing flow.
const DEMO_CHILD_EMAIL = 'zkidchild_demo@kidsafe.test';
const DEMO_CHILD_PASSWORD = 'DemoChild#2026';
const DEMO_CHILD_NAME = 'Demo Child';

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
  const parentUid = await ensureUser(
    auth,
    DEMO_PARENT_PHONE,
    DEMO_PARENT_NAME,
    flags.apply,
  );
  const childUid = await ensureEmailUser(
    auth,
    DEMO_CHILD_EMAIL,
    DEMO_CHILD_PASSWORD,
    DEMO_CHILD_NAME,
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
  // Demo teacher + parent: roles=[] is the whole point -- ZConnect treats
  // these as unroled phone-OTP signups so the role-intent picker is reachable.
  // We therefore use a separate helper that ARRAY-UNIONS into an empty
  // roles[] (preserving any role a previous seed run granted in case the
  // operator also approved them).
  await ensureUnroledUserDoc(db, teacherUid, DEMO_TEACHER_PHONE, flags.apply);
  await ensureUnroledUserDoc(db, parentUid, DEMO_PARENT_PHONE, flags.apply);
  // Demo child: signed up via ZKid email path, paired with the demo parent
  // out of the box, but NOT yet school-linked. This lets QA land directly on
  // the SchoolStep screen by signing in with DEMO_CHILD_EMAIL on ZKid.
  await ensureChildUserDoc(
    db,
    childUid,
    DEMO_CHILD_EMAIL,
    DEMO_CHILD_NAME,
    parentUid,
    flags.apply,
  );

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

  // P4.5 -- import the sample curriculum bundle (cbse_8_science / Force &
  // Pressure) so the demo teacher's Assign Topic flow has real published
  // topics to pick from out of the box. Idempotent against re-runs.
  await seedCurriculum(db, flags.apply);

  // P4.5 -- approve the demo teacher AND stamp them into class 8A so they
  // can immediately assign topics. We never demote an already-approved
  // teacher; this only flips a pending status forward.
  await seedDemoTeacherApproval(db, teacherUid, flags.apply);

  console.log('[done]', flags.apply ? 'applied' : 'dry-run (re-run with --apply)');
}

/**
 * Pulls in the sample bundle under `content/cbse_8_science/` via the
 * importCurriculum helpers so the emulator has a published topic to
 * assign. Re-runs the same import logic the standalone CLI uses, so the
 * idempotency story is identical.
 *
 * Resolves the content path relative to the monorepo root rather than
 * `process.cwd()` because `pnpm seed:staging` is launched from various
 * directories (root, apps/functions/, CI). The seed script lives at
 * `apps/functions/dist/scripts/seedStaging.js` -- four `..` jumps land
 * us at the monorepo root (dist/scripts -> dist -> apps/functions ->
 * apps -> <root>).
 */
async function seedCurriculum(
  db: ReturnType<typeof initScriptAdmin>['db'],
  apply: boolean,
): Promise<void> {
  const contentRoot = path.resolve(__dirname, '..', '..', '..', '..', 'content');
  const bundles = resolveBundles(contentRoot);
  if (bundles.length === 0) {
    console.log(`[skip] no curriculum bundles under ${contentRoot}`);
    return;
  }
  const counts = {curricula: 0, chapters: 0, topics: 0, topicErrors: 0};
  for (const bundle of bundles) {
    console.log(`[bundle] ${bundle}`);
    await importBundle(db, bundle, apply, counts);
  }
  console.log(
    `[curriculum] ${apply ? 'applied' : 'dry-run'} ` +
      `curricula=${counts.curricula} chapters=${counts.chapters} topics=${counts.topics} errors=${counts.topicErrors}`,
  );
}

/**
 * Approves the demo teacher and stamps their uid onto every demo class +
 * its science subject's `teacherIds`. Idempotent -- skips when already
 * applied. This is the same shape `approveTeacher` callable produces in
 * prod, just without going through the callable round-trip.
 */
async function seedDemoTeacherApproval(
  db: ReturnType<typeof initScriptAdmin>['db'],
  teacherUid: string,
  apply: boolean,
): Promise<void> {
  if (teacherUid.startsWith('DRYRUN_')) {
    console.log('[skip] demo teacher approval -- DRYRUN uid (no auth user)');
    return;
  }

  const schoolRef = db.collection('schools').doc(DEMO_SCHOOL_ID);
  const teacherDocRef = schoolRef.collection('teachers').doc(teacherUid);
  const teacherSnap = await teacherDocRef.get();
  if (!teacherSnap.exists) {
    console.log(
      `[skip] schools/${DEMO_SCHOOL_ID}/teachers/${teacherUid} missing -- run seed for users first`,
    );
    return;
  }
  const teacherData = teacherSnap.data() ?? {};

  if (teacherData.status === 'active') {
    console.log(
      `[skip] schools/${DEMO_SCHOOL_ID}/teachers/${teacherUid} already active`,
    );
  } else if (teacherData.status === 'pending') {
    console.log(
      `[plan] schools/${DEMO_SCHOOL_ID}/teachers/${teacherUid} (approve: status=active)`,
    );
    if (apply) {
      await teacherDocRef.update({
        status: 'active',
        approvedByUid: 'seed_script',
        approvedAt: FieldValue.serverTimestamp(),
      });
    }
  } else {
    console.log(
      `[skip] schools/${DEMO_SCHOOL_ID}/teachers/${teacherUid} status=${teacherData.status} -- leaving alone`,
    );
  }

  // Mirror the `users/{uid}.roles arrayUnion 'teacher'` write that
  // `approveTeacher` does. Keeps the seed-only path identical to prod so
  // RoleOnboardingGate doesn't strand the demo teacher.
  const userRef = db.collection('users').doc(teacherUid);
  const userSnap = await userRef.get();
  const userData = userSnap.exists ? userSnap.data() ?? {} : {};
  const roles: string[] = Array.isArray(userData.roles)
    ? userData.roles.filter((r: unknown): r is string => typeof r === 'string')
    : [];
  if (!roles.includes('teacher')) {
    console.log(`[plan] users/${teacherUid} (roles += 'teacher')`);
    if (apply) {
      const patch: Record<string, unknown> = {
        roles: FieldValue.arrayUnion('teacher'),
      };
      if (typeof userData.primaryRole !== 'string' || userData.primaryRole.length === 0) {
        patch.primaryRole = 'teacher';
      }
      await userRef.set(patch, {merge: true});
    }
  } else {
    console.log(`[skip] users/${teacherUid} already has role 'teacher'`);
  }

  // Stamp the teacher into class 8A + each subject (so the Assign topic
  // picker has real options to render).
  for (const klass of CLASSES) {
    const classRef = schoolRef.collection('classes').doc(klass.id);
    const snap = await classRef.get();
    if (!snap.exists) continue;
    const data = snap.data() ?? {};
    const teacherIds: string[] = Array.isArray(data.teacherIds)
      ? data.teacherIds.filter((t: unknown): t is string => typeof t === 'string')
      : [];
    if (teacherIds.includes(teacherUid)) {
      console.log(`[skip] classes/${klass.id} already has teacher`);
    } else {
      console.log(`[plan] classes/${klass.id}.teacherIds += teacher`);
      if (apply) {
        await classRef.update({
          teacherIds: FieldValue.arrayUnion(teacherUid),
        });
      }
    }

    for (const subject of SUBJECTS) {
      const subjectRef = classRef.collection('subjects').doc(subject.id);
      const subjSnap = await subjectRef.get();
      if (!subjSnap.exists) continue;
      const sData = subjSnap.data() ?? {};
      const sTeacherIds: string[] = Array.isArray(sData.teacherIds)
        ? sData.teacherIds.filter(
            (t: unknown): t is string => typeof t === 'string',
          )
        : [];
      if (sTeacherIds.includes(teacherUid)) continue;
      console.log(
        `[plan] classes/${klass.id}/subjects/${subject.id}.teacherIds += teacher`,
      );
      if (apply) {
        await subjectRef.update({
          teacherIds: FieldValue.arrayUnion(teacherUid),
        });
      }
    }
  }
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

/**
 * Email/password counterpart to `ensureUser`. Used by the demo CHILD account
 * because ZKid still ships email signup (Phase P4.4 explicitly kept ZKid on
 * email -- phone OTP migration is deferred). Idempotent.
 */
async function ensureEmailUser(
  auth: ReturnType<typeof initScriptAdmin>['auth'],
  email: string,
  password: string,
  displayName: string,
  apply: boolean,
): Promise<string> {
  try {
    const existing = await auth.getUserByEmail(email);
    console.log(`[skip] auth user ${email} already exists uid=${existing.uid}`);
    return existing.uid;
  } catch {
    console.log(`[plan] auth user ${email} (create displayName="${displayName}")`);
    if (!apply) {
      return `DRYRUN_${email.replace(/[^a-zA-Z0-9]/g, '_')}`;
    }
    const created = await auth.createUser({
      email,
      password,
      displayName,
      emailVerified: true,
    });
    return created.uid;
  }
}

/**
 * P4.4 -- bootstrap a ZKid child user doc that is pre-paired to a parent
 * but NOT yet school-linked. The combination users/{uid}.parentUid set +
 * users/{uid}.schoolIds empty/missing is exactly what `ChildNavigator`'s
 * SchoolStep gate looks for, so QA lands on SchoolStep on first sign-in.
 *
 * Idempotent against an already-linked child: if `roles[]` already includes
 * 'child' AND `parentUid` is set we don't overwrite (don't reset a real
 * school-link if the operator ran the kid flow between seeds).
 */
async function ensureChildUserDoc(
  db: ReturnType<typeof initScriptAdmin>['db'],
  uid: string,
  email: string,
  displayName: string,
  parentUid: string,
  apply: boolean,
): Promise<void> {
  const ref = db.collection('users').doc(uid);
  const snap = await ref.get();
  if (snap.exists) {
    const data = snap.data() ?? {};
    const roles: string[] = Array.isArray(data.roles)
      ? data.roles.filter((r: unknown): r is string => typeof r === 'string')
      : [];
    if (roles.includes('child') && typeof data.parentUid === 'string') {
      console.log(
        `[skip] users/${uid} child already paired (parentUid=${data.parentUid})`,
      );
      return;
    }
    console.log(
      `[plan] users/${uid} (patch: parentUid=${parentUid}, ensure role='child')`,
    );
    if (!apply) return;
    await ref.set(
      {
        parentUid,
        role: 'child',
        roles: FieldValue.arrayUnion('child'),
        primaryRole: data.primaryRole ?? 'child',
      },
      {merge: true},
    );
    return;
  }
  console.log(
    `[plan] users/${uid} (create child paired to parent=${parentUid}, no schoolIds yet)`,
  );
  if (!apply) return;
  await ref.set({
    email,
    name: displayName,
    displayName,
    role: 'child',
    roles: ['child'],
    primaryRole: 'child',
    parentUid,
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
