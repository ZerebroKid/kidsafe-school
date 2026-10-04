'use client';

import {useCallback, useEffect, useState} from 'react';
import Link from 'next/link';
import {collection, doc, getDocs} from 'firebase/firestore';
import {callFn, getFirestoreInstance} from '@zerebro/shared-firebase';
import {useSchool} from '@/lib/school';

interface ClassOption {id: string; className: string}
interface TeacherRow {id: string; displayName: string; phone: string; status: string; classes: string}

export default function TeachersPage() {
  const {schoolId} = useSchool();
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [classIds, setClassIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const schoolRef = doc(getFirestoreInstance(), 'schools', schoolId);
    const [classSnap, teacherSnap] = await Promise.all([
      getDocs(collection(schoolRef, 'classes')),
      getDocs(collection(schoolRef, 'teachers')),
    ]);
    const classRows = classSnap.docs.map(item => ({
      id: item.id,
      className: String(item.data().className ?? item.id),
    }));
    const names = new Map(classRows.map(item => [item.id, item.className]));
    setClasses(classRows);
    setTeachers(teacherSnap.docs.map(item => {
      const data = item.data();
      const ids: string[] = Array.isArray(data.assignedClassIds) ? data.assignedClassIds : [];
      return {
        id: item.id,
        displayName: String(data.displayName ?? 'Teacher'),
        phone: String(data.phone ?? ''),
        status: String(data.status ?? ''),
        classes: ids.map(id => names.get(id) ?? id).join(', '),
      };
    }));
  }, [schoolId]);

  useEffect(() => { void load(); }, [load]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await callFn('addSchoolTeacher', {schoolId, displayName: name, phone, classIds});
      setName('');
      setPhone('');
      setClassIds([]);
      await load();
    } catch {
      setError('Could not save the teacher. Check the phone and pick a class.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
      <section>
        <h1 className="mb-4 text-2xl font-semibold">Teachers</h1>
        <p className="mb-4 text-sm"><Link href="/p/accountants">Invite an accountant</Link></p>
        {teachers.length === 0 ? <p className="text-sm text-text-muted">Invite a teacher with the phone they will use to sign in.</p> : (
          <ul className="divide-y divide-border rounded-2xl border border-border">
            {teachers.map(teacher => (
              <li key={teacher.id} className="px-4 py-3">
                <p className="font-medium">{teacher.displayName}</p>
                <p className="text-sm text-text-muted">{teacher.phone} · {teacher.status} · {teacher.classes}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
      <form className="flex h-fit flex-col gap-3 rounded-2xl border border-border p-4" onSubmit={save}>
        <h2 className="font-semibold">Invite teacher</h2>
        <input className="rounded-xl border border-border px-3 py-2" placeholder="Name" value={name} onChange={event => setName(event.target.value)} required />
        <input className="rounded-xl border border-border px-3 py-2" placeholder="Mobile" value={phone} onChange={event => setPhone(event.target.value)} required />
        <div className="flex flex-col gap-1 text-sm">
          {classes.map(item => (
            <label key={item.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={classIds.includes(item.id)}
                onChange={event => {
                  setClassIds(current => event.target.checked ? [...current, item.id] : current.filter(id => id !== item.id));
                }}
              />
              {item.className}
            </label>
          ))}
        </div>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <button className="rounded-xl bg-primary px-4 py-2 text-primary-text" disabled={saving} type="submit">
          {saving ? 'Saving…' : 'Save teacher'}
        </button>
      </form>
    </div>
  );
}
