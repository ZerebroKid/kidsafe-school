'use client';

import {useCallback, useEffect, useState} from 'react';
import Link from 'next/link';
import {collection, doc, getDocs} from 'firebase/firestore';
import {callFn, getFirestoreInstance} from '@zerebro/shared-firebase';
import {callableError} from '@/lib/callableError';
import {useSchool} from '@/lib/school';

interface AccountantRow {id: string; displayName: string; phone: string; status: string}

export default function AccountantsPage() {
  const {schoolId} = useSchool();
  const [rows, setRows] = useState<AccountantRow[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const snap = await getDocs(collection(doc(getFirestoreInstance(), 'schools', schoolId), 'accountants'));
    setRows(snap.docs.map(item => ({
      id: item.id,
      displayName: String(item.data().displayName ?? 'Accountant'),
      phone: String(item.data().phone ?? ''),
      status: String(item.data().status ?? ''),
    })));
  }, [schoolId]);

  useEffect(() => { void load(); }, [load]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await callFn('addSchoolAccountant', {schoolId, displayName: name, phone});
      setName('');
      setPhone('');
      await load();
    } catch (err) {
      setError(callableError(err, 'Could not save the accountant.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
      <section>
        <h1 className="mb-4 text-2xl font-semibold">Accountants</h1>
        <p className="mb-4 text-sm text-text-muted">Invite the phone before that person signs in. They upload monthly fees.</p>
        {rows.length === 0 ? <p className="text-sm text-text-muted">No accountant yet.</p> : (
          <ul className="divide-y divide-border rounded-2xl border border-border">
            {rows.map(row => (
              <li key={row.id} className="px-4 py-3">
                <p className="font-medium">{row.displayName}</p>
                <p className="text-sm text-text-muted">{row.phone} · {row.status}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
      <form className="flex h-fit flex-col gap-3 rounded-2xl border border-border p-4" onSubmit={save}>
        <h2 className="font-semibold">Invite accountant</h2>
        <input className="rounded-xl border border-border px-3 py-2" placeholder="Name" value={name} onChange={event => setName(event.target.value)} required />
        <input className="rounded-xl border border-border px-3 py-2" placeholder="Mobile" value={phone} onChange={event => setPhone(event.target.value)} required />
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <button className="rounded-xl bg-primary px-4 py-2 text-primary-text" disabled={saving} type="submit">
          {saving ? 'Saving…' : 'Save accountant'}
        </button>
        <Link className="text-sm text-text-muted" href="/p/teachers">Back to teachers</Link>
      </form>
    </div>
  );
}
