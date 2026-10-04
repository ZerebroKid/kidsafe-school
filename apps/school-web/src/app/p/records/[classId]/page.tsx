'use client';

import {useCallback, useEffect, useState} from 'react';
import {useParams} from 'next/navigation';
import {collection, doc, getDoc, getDocs, query, where} from 'firebase/firestore';
import {callFn, getFirestoreInstance} from '@zerebro/shared-firebase';
import {useSchool} from '@/lib/school';
import {parseStudentSheet} from '@/lib/studentSheet';

interface Student {
  id: string;
  name: string;
  rollNo: string;
  parentName: string;
  parentPhone: string;
  status: string;
}

const emptyForm = {name: '', rollNo: '', parentName: '', parentPhone: ''};

export default function ClassStudentsPage() {
  const {classId} = useParams<{classId: string}>();
  const {schoolId} = useSchool();
  const [className, setClassName] = useState('Class');
  const [students, setStudents] = useState<Student[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);

  const load = useCallback(async () => {
    const db = getFirestoreInstance();
    const schoolRef = doc(db, 'schools', schoolId);
    const classSnap = await getDoc(doc(schoolRef, 'classes', classId));
    const name = classSnap.data()?.className;
    if (typeof name === 'string') setClassName(name);
    const snap = await getDocs(query(collection(schoolRef, 'students'), where('classId', '==', classId)));
    const next = snap.docs.map(item => {
      const data = item.data();
      return {
        id: item.id,
        name: String(data.name ?? ''),
        rollNo: String(data.rollNo ?? ''),
        parentName: String(data.parentName ?? ''),
        parentPhone: String(data.parentPhone ?? ''),
        status: String(data.status ?? 'active'),
      };
    });
    next.sort((a, b) => a.rollNo.localeCompare(b.rollNo, undefined, {numeric: true}) || a.name.localeCompare(b.name));
    setStudents(next);
  }, [classId, schoolId]);

  useEffect(() => { void load(); }, [load]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSummary(null);
    try {
      await callFn('upsertStudent', {
        schoolId,
        classId,
        studentId: editing ?? undefined,
        ...form,
      });
      setForm(emptyForm);
      setEditing(null);
      await load();
    } catch {
      setError('Could not save the student.');
    } finally {
      setSaving(false);
    }
  };

  const markLeft = async (studentId: string) => {
    await callFn('markStudentLeft', {schoolId, studentId});
    await load();
  };

  const downloadSample = () => {
    const csv = 'Name,Roll number,Parent name,Parent phone\nAman,1,Ravi,9876543210\nBina,2,Seema,\n';
    const url = URL.createObjectURL(new Blob([csv], {type: 'text/csv'}));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'students-sample.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const upload = async (file: File) => {
    setImporting(true);
    setError(null);
    setSummary(null);
    try {
      const rows = parseStudentSheet(await file.arrayBuffer());
      const result = await callFn<
        {schoolId: string; classId: string; rows: typeof rows},
        {created: number; updated: number; skipped: {row: number; reason: string}[]}
      >('importClassStudents', {schoolId, classId, rows});
      const skipped = result.skipped.map(item => `Row ${item.row}: ${item.reason}`).join(' ');
      setSummary(`Added ${result.created}, updated ${result.updated}.${skipped ? ` ${skipped}` : ''}`);
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      setError(message.startsWith('The ') || message.startsWith('Upload ') ? message : 'Could not upload the students.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_280px]">
      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">{className}</h1>
          <div className="flex flex-wrap gap-3 text-sm">
            <button type="button" onClick={downloadSample}>Download sample</button>
            <label className={`rounded-xl bg-primary px-4 py-2 text-primary-text ${importing ? 'opacity-60' : 'cursor-pointer'}`}>
              {importing ? 'Uploading…' : 'Upload Excel or CSV'}
              <input
                className="hidden"
                type="file"
                accept=".csv,.xlsx,.xls,text/csv"
                disabled={importing}
                onChange={event => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  if (file) void upload(file);
                }}
              />
            </label>
          </div>
        </div>
        {summary ? <p className="mb-3 text-sm text-text-muted">{summary}</p> : null}
        {error ? <p className="mb-3 text-sm text-danger">{error}</p> : null}
        {students.length === 0 ? <p className="text-sm text-text-muted">No students in this class yet.</p> : (
          <ul className="divide-y divide-border rounded-2xl border border-border">
            {students.map(student => (
              <li key={student.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div>
                  <p className="font-medium">{student.rollNo ? `${student.rollNo}. ` : ''}{student.name}</p>
                  <p className="text-sm text-text-muted">{student.parentName} {student.parentPhone}</p>
                </div>
                <div className="flex gap-3 text-sm">
                  {student.status === 'left' ? <span className="text-text-muted">Left</span> : (
                    <>
                      <button type="button" onClick={() => {
                    setEditing(student.id);
                    setForm({
                      name: student.name,
                      rollNo: student.rollNo,
                      parentName: student.parentName,
                      parentPhone: student.parentPhone,
                    });
                  }}>Edit</button>
                      <button className="text-danger" type="button" onClick={() => void markLeft(student.id)}>Mark left</button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <form className="flex h-fit flex-col gap-3 rounded-2xl border border-border p-4" onSubmit={save}>
        <h2 className="font-semibold">{editing ? 'Edit student' : 'Add student'}</h2>
        {(['name', 'rollNo', 'parentName', 'parentPhone'] as const).map(field => (
          <label key={field} className="text-sm">
            {field === 'name' ? 'Name' : field === 'rollNo' ? 'Roll number' : field === 'parentName' ? 'Parent name' : 'Parent phone'}
            <input
              className="mt-1 w-full rounded-xl border border-border px-3 py-2"
              required={field === 'name'}
              value={form[field]}
              onChange={event => setForm(current => ({...current, [field]: event.target.value}))}
            />
          </label>
        ))}
        <button className="rounded-xl bg-primary px-4 py-2 text-primary-text" disabled={saving} type="submit">
          {saving ? 'Saving…' : 'Save'}
        </button>
        {editing ? <button type="button" onClick={() => { setEditing(null); setForm(emptyForm); }}>Cancel</button> : null}
      </form>
    </div>
  );
}
