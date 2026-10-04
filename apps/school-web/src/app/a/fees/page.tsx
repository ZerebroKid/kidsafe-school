'use client';

import {useState} from 'react';
import {callFn} from '@zerebro/shared-firebase';
import {FeeTable} from '@/components/FeeTable';
import {callableError} from '@/lib/callableError';
import {currentMonth} from '@/lib/dates';
import {parseFeeSheet} from '@/lib/feeSheet';
import {useMonthFees} from '@/lib/feeRows';
import {useSchool} from '@/lib/school';

export default function AccountantFeesPage() {
  const {schoolId} = useSchool();
  const [month, setMonth] = useState(currentMonth());
  const {rows, load} = useMonthFees(schoolId, month, false);
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const downloadSample = () => {
    const csv = `Class,Name,Roll number,Month,Amount due,Amount paid\n5A,Aman,1,${month},1500,500\n5A,Bina,2,${month},1500,1500\n`;
    const url = URL.createObjectURL(new Blob([csv], {type: 'text/csv'}));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'fees-sample.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const upload = async (file: File) => {
    setImporting(true);
    setError(null);
    setSummary(null);
    try {
      const sheetRows = parseFeeSheet(await file.arrayBuffer());
      const result = await callFn<
        {schoolId: string; rows: typeof sheetRows},
        {created: number; updated: number; skipped: {row: number; reason: string}[]}
      >('importSchoolFees', {schoolId, rows: sheetRows});
      const skipped = result.skipped.map(item => `Row ${item.row}: ${item.reason}`).join(' ');
      setSummary(`Added ${result.created}, updated ${result.updated}.${skipped ? ` ${skipped}` : ''}`);
      await load();
    } catch (err) {
      const message = callableError(err, 'Could not upload the fees.');
      setError(message.startsWith('The ') || message.startsWith('Upload ') ? message : 'Could not upload the fees.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Fees</h1>
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
      <input className="w-fit rounded-xl border border-border px-3 py-2" type="month" value={month} onChange={event => setMonth(event.target.value)} />
      {summary ? <p className="text-sm text-text-muted">{summary}</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {rows && rows.length === 0 ? <p className="text-sm text-text-muted">No fee has been uploaded for this month.</p> : null}
      {rows && rows.length > 0 ? <FeeTable rows={rows} /> : null}
    </div>
  );
}
