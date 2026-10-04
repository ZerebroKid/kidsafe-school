import {HttpsError, onCall} from 'firebase-functions/v2/https';
import {FieldValue, type DocumentReference} from 'firebase-admin/firestore';

import {db} from '../lib/admin';
import {requireAuth} from '../lib/auth';
import {normalizePhoneToE164} from '../lib/phone';
import {requirePrincipalOfSchool, requireSchoolId} from '../lib/schoolWeb';

const MAX_ROWS = 400;

interface RowInput {
  row?: number;
  name?: string;
  rollNo?: string;
  parentName?: string;
  parentPhone?: string;
}

interface Input {
  schoolId: string;
  classId: string;
  rows: RowInput[];
}

interface Skipped {
  row: number;
  reason: string;
}

interface Output {
  created: number;
  updated: number;
  skipped: Skipped[];
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function matchKey(name: string, rollNo: string): string {
  return `${name.trim().toLowerCase().replace(/\s+/g, ' ')}|${rollNo.trim()}`;
}

export const importClassStudents = onCall<Input, Promise<Output>>(
  {region: 'asia-south1'},
  async request => {
    const caller = requireAuth(request);
    const data = request.data ?? ({} as Input);
    const schoolId = requireSchoolId(data.schoolId);
    const classId = typeof data.classId === 'string' ? data.classId : '';
    const rows = Array.isArray(data.rows) ? data.rows : null;
    if (!classId || !rows) {
      throw new HttpsError('invalid-argument', 'Class and rows are required.');
    }
    if (rows.length > MAX_ROWS) {
      throw new HttpsError('invalid-argument', `Upload at most ${MAX_ROWS} students at a time.`);
    }
    await requirePrincipalOfSchool(caller.uid, schoolId);

    const schoolRef = db().collection('schools').doc(schoolId);
    const classSnap = await schoolRef.collection('classes').doc(classId).get();
    if (!classSnap.exists) throw new HttpsError('not-found', 'Class not found.');
    const teacherIds: string[] = Array.isArray(classSnap.data()?.teacherIds)
      ? classSnap.data()?.teacherIds.filter((id: unknown): id is string => typeof id === 'string')
      : [];

    const existing = await schoolRef.collection('students').where('classId', '==', classId).get();
    const known = new Map<string, DocumentReference>();
    for (const item of existing.docs) {
      const student = item.data();
      const name = typeof student.name === 'string' ? student.name : '';
      const rollNo = typeof student.rollNo === 'string' ? student.rollNo : '';
      if (!name) continue;
      const key = matchKey(name, rollNo);
      if (!known.has(key)) known.set(key, item.ref);
    }

    const skipped: Skipped[] = [];
    const batch = db().batch();
    let created = 0;
    let updated = 0;
    let writes = 0;

    rows.forEach((raw, index) => {
      const row = typeof raw?.row === 'number' && raw.row > 0 ? raw.row : index + 2;
      const name = text(raw?.name);
      const rollNo = text(raw?.rollNo);
      const parentName = text(raw?.parentName);
      const parentPhoneRaw = text(raw?.parentPhone);
      if (!name && !rollNo && !parentName && !parentPhoneRaw) return;
      if (!name) {
        skipped.push({row, reason: 'Name is required.'});
        return;
      }
      let parentPhone = '';
      if (parentPhoneRaw) {
        try {
          parentPhone = normalizePhoneToE164(parentPhoneRaw);
        } catch {
          skipped.push({row, reason: 'Parent phone is not a valid mobile number.'});
          return;
        }
      }

      const key = matchKey(name, rollNo);
      const match = known.get(key);
      const ref = match ?? schoolRef.collection('students').doc();
      batch.set(
        ref,
        {
          name,
          rollNo,
          classId,
          parentName,
          parentPhone,
          readerIds: teacherIds,
          status: 'active',
          ...(match ? {} : {createdAt: FieldValue.serverTimestamp()}),
          updatedAt: FieldValue.serverTimestamp(),
        },
        {merge: true},
      );
      writes += 1;
      if (match) updated += 1;
      else {
        created += 1;
        known.set(key, ref);
      }
    });

    if (writes > 0) await batch.commit();
    return {created, updated, skipped};
  },
);
