/*
 * Shared placeholder used across every (dashboard) route until the real
 * panel content lands. Duplicated from apps/principal-web on purpose so
 * Admin can diverge cheaply (e.g. internal-only debug banners) without
 * touching Campus.
 */
export function ComingSoonPanel({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="max-w-md rounded-2xl border border-border bg-surface p-8 text-center">
        <p className="text-xs uppercase tracking-widest text-primary">
          Coming soon
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-text">{title}</h1>
        <p className="mt-2 text-sm text-text-muted">{description}</p>
      </div>
    </div>
  );
}
