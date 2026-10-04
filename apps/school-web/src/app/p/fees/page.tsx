'use client';

import {Suspense, useState} from 'react';
import {useSearchParams} from 'next/navigation';
import {FeeTable} from '@/components/FeeTable';
import {currentMonth} from '@/lib/dates';
import {useMonthFees} from '@/lib/feeRows';
import {useSchool} from '@/lib/school';

function FeesView() {
  const {schoolId} = useSchool();
  const params = useSearchParams();
  const [month, setMonth] = useState(currentMonth());
  const [pendingOnly, setPendingOnly] = useState(params.get('view') === 'pending');
  const {rows} = useMonthFees(schoolId, month, pendingOnly);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Fees</h1>
      <div className="flex flex-wrap items-center gap-3">
        <input className="rounded-xl border border-border px-3 py-2" type="month" value={month} onChange={event => setMonth(event.target.value)} />
        <button className={`rounded-full px-3 py-1 text-sm ${pendingOnly ? 'border border-border' : 'bg-nav-active text-nav-active-text'}`} type="button" onClick={() => setPendingOnly(false)}>All records</button>
        <button className={`rounded-full px-3 py-1 text-sm ${pendingOnly ? 'bg-nav-active text-nav-active-text' : 'border border-border'}`} type="button" onClick={() => setPendingOnly(true)}>Pending</button>
      </div>
      {rows && rows.length === 0 ? (
        <p className="text-sm text-text-muted">
          {pendingOnly ? 'No student has a pending fee this month.' : 'No fee has been uploaded for this month.'}
        </p>
      ) : null}
      {rows && rows.length > 0 ? <FeeTable rows={rows} /> : null}
    </div>
  );
}

export default function PrincipalFeesPage() {
  return (
    <Suspense fallback={<p className="text-text-muted">Loading fees…</p>}>
      <FeesView />
    </Suspense>
  );
}
