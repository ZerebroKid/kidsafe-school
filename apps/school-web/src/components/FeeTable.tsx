import {compareClasses} from '@/lib/classes';

export interface FeeRow {
  id: string;
  className: string;
  name: string;
  rollNo: string;
  month: string;
  amountDue: number;
  amountPaid: number;
  balance: number;
  pending: boolean;
  grade: number;
  section: string;
}

export function rupees(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export function FeeTable({rows}: {rows: FeeRow[]}) {
  const sorted = [...rows].sort((a, b) => compareClasses(a, b) || a.rollNo.localeCompare(b.rollNo, undefined, {numeric: true}) || a.name.localeCompare(b.name));
  if (sorted.length === 0) return null;
  return (
    <ul className="divide-y divide-border rounded-2xl border border-border">
      {sorted.map(row => (
        <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="font-medium">{row.rollNo ? `${row.rollNo}. ` : ''}{row.name}</p>
            <p className="text-sm text-text-muted">{row.className} · {row.month}</p>
          </div>
          <p className="text-sm">
            Due {rupees(row.amountDue)} · Paid {rupees(row.amountPaid)} ·{' '}
            <span className={row.pending ? 'text-danger' : 'text-success'}>
              {row.pending ? `Pending ${rupees(row.balance)}` : 'Cleared'}
            </span>
          </p>
        </li>
      ))}
    </ul>
  );
}
