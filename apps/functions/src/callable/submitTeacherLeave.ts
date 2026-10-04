import {HttpsError, onCall} from 'firebase-functions/v2/https';
import {FieldValue} from 'firebase-admin/firestore';

import {db} from '../lib/admin';
import {requireAuth} from '../lib/auth';
import {requireActiveTeacher, requireSchoolId} from '../lib/schoolWeb';

const MAX_DAYS = 31;

interface Input {
  schoolId: string;
  startDate: string;
  endDate: string;
  reason: string;
}

function ymd(value: unknown): string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '';
}

function inclusiveDays(start: string, end: string): number {
  const startMs = Date.parse(`${start}T00:00:00Z`);
  const endMs = Date.parse(`${end}T00:00:00Z`);
  return Math.round((endMs - startMs) / 86_400_000) + 1;
}

export const submitTeacherLeave = onCall<Input, Promise<{leaveId: string}>>(
  {region: 'asia-south1'},
  async request => {
    const caller = requireAuth(request);
    const schoolId = requireSchoolId(request.data?.schoolId);
    const startDate = ymd(request.data?.startDate);
    const endDate = ymd(request.data?.endDate);
    const reason = typeof request.data?.reason === 'string' ? request.data.reason.trim() : '';
    if (!startDate || !endDate) throw new HttpsError('invalid-argument', 'Choose a start and end date.');
    if (endDate < startDate) throw new HttpsError('invalid-argument', 'The end date must be on or after the start date.');
    if (inclusiveDays(startDate, endDate) > MAX_DAYS) {
      throw new HttpsError('invalid-argument', 'Leave can cover at most 31 days.');
    }
    if (!reason) throw new HttpsError('invalid-argument', 'A reason is required.');
    const teacher = await requireActiveTeacher(caller.uid, schoolId);

    const schoolRef = db().collection('schools').doc(schoolId);
    const existing = await schoolRef.collection('leaves')
      .where('teacherUid', '==', caller.uid)
      .where('status', 'in', ['pending', 'approved'])
      .get();
    const overlap = existing.docs.some(item => {
      const start = item.data().startDate;
      const end = item.data().endDate;
      return typeof start === 'string' && typeof end === 'string' && startDate <= end && start <= endDate;
    });
    if (overlap) {
      throw new HttpsError(
        'failed-precondition',
        'Those dates overlap a leave request that is still pending or already approved.',
      );
    }

    const ref = schoolRef.collection('leaves').doc();
    await ref.set({
      teacherUid: caller.uid,
      teacherName: teacher.displayName,
      startDate,
      endDate,
      reason,
      status: 'pending',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return {leaveId: ref.id};
  },
);
