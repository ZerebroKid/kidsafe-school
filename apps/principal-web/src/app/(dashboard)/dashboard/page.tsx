'use client';

/*
 * P5.2 -- principal coverage dashboard.
 *
 * One card per class showing the LATEST nightly snapshot the aggregator cron
 * produced (engagement + mastery) alongside cumulative assigned-topic coverage.
 * Reads are load-once via useSchoolCoverage (reports change nightly), keeping
 * the page under the <1s target.
 */

import Link from 'next/link';

import {useOwnSchool} from '@/lib/ownSchool';
import {useSchoolCoverage, type ClassCoverage} from '@/lib/schoolReports';
import {daysAgoInSchoolTz} from '@/lib/schoolTime';
import {StatTile} from '@/components/coverage/StatTile';
import {CoverageBar} from '@/components/coverage/CoverageBar';

export default function CampusDashboardPage() {
  const own = useOwnSchool();
  const coverage = useSchoolCoverage(own.schoolId);

  if (own.loading) return <p className="text-sm text-text-muted">Loading…</p>;
  if (own.error) {
    return (
      <div
        role="alert"
        className="rounded-2xl border border-danger/40 bg-danger/10 p-8 text-center"
      >
        <p className="text-sm font-medium text-danger">
          Could not load your school
        </p>
        <p className="mt-2 font-mono text-xs text-danger/80">{own.error}</p>
      </div>
    );
  }
  if (!own.schoolId) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-8 text-center">
        <p className="text-sm text-text-muted">
          We could not find a school assigned to your account. If you just got
          approved, refresh the page; otherwise contact your admin.
        </p>
      </div>
    );
  }

  const rows = coverage.data;

  return (
    <main className="flex flex-col gap-6">
      <header>
        <p className="text-xs uppercase tracking-widest text-text-muted">
          Dashboard
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-text">
          Class coverage
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          Latest study activity per class, refreshed nightly.
        </p>
      </header>

      {coverage.error ? (
        <p
          role="alert"
          className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
        >
          {coverage.error}
        </p>
      ) : null}

      {rows === null ? (
        <p className="text-sm text-text-muted">Loading coverage…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface p-8 text-center">
          <p className="text-sm text-text-muted">
            No classes yet.{' '}
            <Link href="/classes/new" className="text-primary hover:underline">
              Create one
            </Link>{' '}
            to start tracking coverage.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map(row => (
            <CoverageCard key={row.classId} row={row} />
          ))}
        </div>
      )}
    </main>
  );
}

function CoverageCard({row}: {row: ClassCoverage}) {
  const hasReport = row.reportDate !== null;
  const staleDays = row.reportDate ? daysAgoInSchoolTz(row.reportDate) : null;
  const avgTone =
    row.avgBestPercentage === null
      ? 'default'
      : row.avgBestPercentage >= 70
        ? 'success'
        : row.avgBestPercentage >= 40
          ? 'warning'
          : 'danger';

  return (
    <Link
      href={`/classes/${row.classId}`}
      className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5 transition-colors hover:border-primary/60"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-text">{row.className}</h2>
          <p className="text-xs text-text-muted">
            {row.rosterSize} student{row.rosterSize === 1 ? '' : 's'}
            {row.assignedTopicsTotal > 0
              ? ` · ${row.assignedTopicsTotal} topic${
                  row.assignedTopicsTotal === 1 ? '' : 's'
                } assigned`
              : ''}
          </p>
        </div>
        <ReportFreshness hasReport={hasReport} staleDays={staleDays} />
      </div>

      {hasReport ? (
        <>
          <div className="grid grid-cols-3 gap-2">
            <StatTile
              label="Attempted"
              value={`${row.attemptedStudents}/${row.rosterSize}`}
            />
            <StatTile label="Passed" value={row.passedStudents} tone="success" />
            <StatTile
              label="Avg score"
              value={
                row.avgBestPercentage === null
                  ? '—'
                  : `${row.avgBestPercentage}%`
              }
              tone={avgTone}
            />
          </div>
          <div className="flex flex-col gap-2">
            <CoverageBar
              label="Engagement"
              value={row.attemptedStudents}
              total={row.rosterSize}
            />
            <CoverageBar
              label="Pass rate"
              value={row.passedStudents}
              total={row.rosterSize}
              tone="success"
            />
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-border bg-bg p-4 text-center">
          <p className="text-sm text-text-muted">No activity yet</p>
          <p className="mt-1 text-xs text-text-muted">
            Reports appear after students attempt assigned quizzes.
          </p>
        </div>
      )}
    </Link>
  );
}

function ReportFreshness({
  hasReport,
  staleDays,
}: {
  hasReport: boolean;
  staleDays: number | null;
}) {
  if (!hasReport) {
    return (
      <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-widest text-text-muted">
        No report
      </span>
    );
  }
  const label =
    staleDays === null
      ? 'Latest'
      : staleDays <= 0
        ? 'Today'
        : staleDays === 1
          ? 'Yesterday'
          : `${staleDays}d ago`;
  const stale = staleDays !== null && staleDays > 2;
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-widest ${
        stale
          ? 'bg-warning/10 text-warning'
          : 'border border-border text-text-muted'
      }`}
    >
      {label}
    </span>
  );
}
