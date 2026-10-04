import {HttpsError, onCall} from 'firebase-functions/v2/https';
import {FieldValue, type DocumentReference} from 'firebase-admin/firestore';

import {db} from '../lib/admin';
import {requireAuth} from '../lib/auth';
import {requireAccountantOfSchool, requireSchoolId} from '../lib/schoolWeb';

const MAX_ROWS = 400;

interface RowInput {
  row?: number;
  className?: string;
  name?: string;
  rollNo?: string;
  month?: string;
  amountDue?: string;
  amountPaid?: string;
}

interface Input {
  schoolId: string;
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

function classKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

function rupees(raw: string): number | null {
  if (!raw) return null;
  const value = Number(raw.replace(/,/g, ''));
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100) / 100;
}

export const importSchoolFees = onCall<Input, Promise<Output>>(
  {region: 'asia-south1'},
  async request => {
    const caller = requireAuth(request);
    const data = request.data ?? ({} as Input);
    const schoolId = requireSchoolId(data.schoolId);
    const rows = Array.isArray(data.rows) ? data.rows : null;
    if (!rows) throw new HttpsError('invalid-argument', 'Rows are required.');
    if (rows.length > MAX_ROWS) {
      throw new HttpsError('invalid-argument', `Upload at most ${MAX_ROWS} rows at a time.`);
    }
    await requireAccountantOfSchool(caller.uid, schoolId);

    const schoolRef = db().collection('schools').doc(schoolId);
    const [classSnap, studentSnap] = await Promise.all([
      schoolRef.collection('classes').get(),
      schoolRef.collection('students').get(),
    ]);

    const classesByName = new Map<string, {id: string; className: string; grade: number; section: string}[]>();
    for (const item of classSnap.docs) {
      const className = typeof item.data().className === 'string' ? item.data().className : item.id;
      const key = classKey(className);
      const list = classesByName.get(key) ?? [];
      list.push({
        id: item.id,
        className,
        grade: typeof item.data().grade === 'number' ? item.data().grade : 99,
        section: typeof item.data().section === 'string' ? item.data().section : '',
      });
      classesByName.set(key, list);
    }

    const studentsByClass = new Map<string, Map<string, {id: string; name: string; rollNo: string; status: string}>>();
    for (const item of studentSnap.docs) {
      const student = item.data();
      const classId = typeof student.classId === 'string' ? student.classId : '';
      const name = typeof student.name === 'string' ? student.name : '';
      if (!classId || !name) continue;
      const rollNo = typeof student.rollNo === 'string' ? student.rollNo : '';
      const byKey = studentsByClass.get(classId) ?? new Map();
      const key = matchKey(name, rollNo);
      if (!byKey.has(key)) {
        byKey.set(key, {
          id: item.id,
          name,
          rollNo,
          status: typeof student.status === 'string' ? student.status : 'active',
        });
      }
      studentsByClass.set(classId, byKey);
    }

    const skipped: Skipped[] = [];
    const prepared = new Map<string, {
      ref: DocumentReference;
      studentId: string;
      classId: string;
      className: string;
      grade: number;
      section: string;
      name: string;
      rollNo: string;
      month: string;
      amountDue: number;
      amountPaid: number;
    }>();

    for (const [index, raw] of rows.entries()) {
      const row = typeof raw?.row === 'number' && raw.row > 0 ? raw.row : index + 2;
      const className = text(raw?.className);
      const name = text(raw?.name);
      const rollNo = text(raw?.rollNo);
      const month = text(raw?.month);
      const dueRaw = text(raw?.amountDue);
      const paidRaw = text(raw?.amountPaid);
      if (!className && !name && !rollNo && !month && !dueRaw && !paidRaw) continue;
      if (!className || !name || !month) {
        skipped.push({row, reason: 'Class, name, and month are required.'});
        continue;
      }
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
        skipped.push({row, reason: 'Month must be YYYY-MM.'});
        continue;
      }
      const matches = classesByName.get(classKey(className)) ?? [];
      if (matches.length === 0) {
        skipped.push({row, reason: `No class is named ${className}.`});
        continue;
      }
      if (matches.length > 1) {
        skipped.push({row, reason: `More than one class is named ${className}.`});
        continue;
      }
      const amountDue = rupees(dueRaw);
      const amountPaid = rupees(paidRaw);
      if (amountDue === null || amountPaid === null) {
        skipped.push({row, reason: 'Amount due and amount paid must be numbers.'});
        continue;
      }
      if (amountDue < 0 || amountPaid < 0) {
        skipped.push({row, reason: 'Amounts cannot be negative.'});
        continue;
      }
      if (amountPaid > amountDue) {
        skipped.push({row, reason: 'Amount paid cannot be more than amount due.'});
        continue;
      }
      const student = studentsByClass.get(matches[0].id)?.get(matchKey(name, rollNo));
      if (!student) {
        skipped.push({row, reason: 'No student with this name and roll is in that class.'});
        continue;
      }
      if (student.status === 'left') {
        skipped.push({row, reason: 'This student has left.'});
        continue;
      }

      const feeId = `${student.id}_${month}`;
      prepared.set(feeId, {
        ref: schoolRef.collection('fees').doc(feeId),
        studentId: student.id,
        classId: matches[0].id,
        className: matches[0].className,
        grade: matches[0].grade,
        section: matches[0].section,
        name: student.name,
        rollNo: student.rollNo,
        month,
        amountDue,
        amountPaid,
      });
    }

    const refs = [...prepared.values()].map(item => item.ref);
    const already = new Set<string>();
    for (let offset = 0; offset < refs.length; offset += 100) {
      const snaps = await db().getAll(...refs.slice(offset, offset + 100));
      for (const snap of snaps) {
        if (snap.exists) already.add(snap.ref.path);
      }
    }
    const batch = db().batch();
    let created = 0;
    let updated = 0;
    for (const item of prepared.values()) {
      const existed = already.has(item.ref.path);
      batch.set(item.ref, {
        studentId: item.studentId,
        classId: item.classId,
        className: item.className,
        grade: item.grade,
        section: item.section,
        name: item.name,
        rollNo: item.rollNo,
        month: item.month,
        amountDue: item.amountDue,
        amountPaid: item.amountPaid,
        balance: Math.round((item.amountDue - item.amountPaid) * 100) / 100,
        pending: item.amountDue > item.amountPaid,
        ...(existed ? {} : {createdAt: FieldValue.serverTimestamp()}),
        updatedAt: FieldValue.serverTimestamp(),
      }, {merge: true});
      if (existed) updated += 1;
      else created += 1;
    }
    if (prepared.size > 0) await batch.commit();
    return {created, updated, skipped};
  },
);
