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

const DEMO_SCHOOL_ID = 'demo_school_001';
const DEMO_SCHOOL_NAME = 'Demo Public School';
const DEMO_SCHOOL_CITY = 'Mumbai';
const DEMO_INVITE_CODE = 'DEMO2026';

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

  await ensureUserDoc(db, adminUid, DEMO_ADMIN_PHONE, 'admin', flags.apply);
  await ensureUserDoc(
    db,
    principalUid,
    DEMO_PRINCIPAL_PHONE,
    'principal',
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
        principalUid,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
  } else if (!schoolSnap.data()?.principalUid) {
    // School exists but is unstamped (e.g. an old partial run). Stamp it now
    // so the rules' belongsToSchool() path opens up for the demo principal.
    console.log(`[plan] schools/${DEMO_SCHOOL_ID} (stamp principalUid)`);
    if (flags.apply) {
      await schoolRef.update({principalUid});
    }
  } else {
    console.log(`[skip] schools/${DEMO_SCHOOL_ID} already seeded`);
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
