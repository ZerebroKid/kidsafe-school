/*
 * Labelled CSS progress bar (no charting dependency). Renders `value/total` as
 * a percentage-filled track. Divide-by-zero safe: a 0 total yields an empty
 * bar and a "—" readout rather than NaN.
 */
export function CoverageBar({
  label,
  value,
  total,
  tone = 'primary',
}: {
  label: string;
  value: number;
  total: number;
  tone?: 'primary' | 'success';
}) {
  const safeTotal = total > 0 ? total : 0;
  const pct =
    safeTotal > 0 ? Math.min(100, Math.round((value / safeTotal) * 100)) : 0;
  const fill = tone === 'success' ? 'bg-success' : 'bg-primary';
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-xs text-text-muted">{label}</span>
        <span className="text-xs font-medium text-text">
          {safeTotal > 0 ? `${value}/${safeTotal} · ${pct}%` : '—'}
        </span>
      </div>
      <div
        className="mt-1 h-2 overflow-hidden rounded-full bg-surface-alt"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className={`h-full rounded-full ${fill}`}
          style={{width: `${pct}%`}}
        />
      </div>
    </div>
  );
}
