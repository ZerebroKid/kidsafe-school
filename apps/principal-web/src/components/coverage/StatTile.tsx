/*
 * Compact label/value tile used inside coverage cards and the class drill-down.
 * Pure presentation; styled with the shared brand tokens.
 */
export function StatTile({
  label,
  value,
  sub,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: 'default' | 'success' | 'warning' | 'danger';
}) {
  const valueTone =
    tone === 'success'
      ? 'text-success'
      : tone === 'warning'
        ? 'text-warning'
        : tone === 'danger'
          ? 'text-danger'
          : 'text-text';
  return (
    <div className="rounded-xl border border-border bg-bg p-3">
      <p className="text-[10px] uppercase tracking-widest text-text-muted">
        {label}
      </p>
      <p className={`mt-1 text-xl font-semibold ${valueTone}`}>{value}</p>
      {sub ? <p className="mt-0.5 text-xs text-text-muted">{sub}</p> : null}
    </div>
  );
}
