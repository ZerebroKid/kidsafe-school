'use client';

import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {addDoc, collection, doc} from 'firebase/firestore';
import {getFirestoreInstance} from '@zerebro/shared-firebase';
import {classLabel} from '@/lib/classes';
import {academicYear} from '@/lib/dates';
import {useSchool} from '@/lib/school';

export default function NewClassPage() {
  const {schoolId} = useSchool();
  const router = useRouter();
  const [grade, setGrade] = useState(0);
  const [section, setSection] = useState('A');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const cleanSection = section.trim().toUpperCase();
    if (!cleanSection) {
      setError('Enter a section.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const ref = await addDoc(collection(doc(getFirestoreInstance(), 'schools', schoolId), 'classes'), {
        grade,
        section: cleanSection,
        className: classLabel(grade, cleanSection),
        academicYear: academicYear(),
        teacherIds: [],
        studentChildUids: [],
      });
      router.replace(`/p/records/${ref.id}`);
    } catch {
      setError('Could not create the class. Sign out and sign in again, then retry.');
      setSaving(false);
    }
  };

  return (
    <form className="mx-auto flex max-w-md flex-col gap-3" onSubmit={save}>
      <h1 className="text-2xl font-semibold">New class</h1>
      <label className="text-sm font-medium">
        Grade
        <select className="mt-1 w-full rounded-xl border border-border px-3 py-2" value={grade} onChange={event => setGrade(Number(event.target.value))}>
          <option value={0}>Nursery</option>
          {Array.from({length: 12}, (_, index) => index + 1).map(item => <option key={item} value={item}>{item}</option>)}
        </select>
      </label>
      <label className="text-sm font-medium">
        Section
        <input className="mt-1 w-full rounded-xl border border-border px-3 py-2" value={section} onChange={event => setSection(event.target.value)} />
      </label>
      <p className="text-sm text-text-muted">Year {academicYear()}</p>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <button className="rounded-xl bg-primary px-4 py-2 text-primary-text" disabled={saving} type="submit">
        {saving ? 'Saving…' : 'Create class'}
      </button>
    </form>
  );
}
