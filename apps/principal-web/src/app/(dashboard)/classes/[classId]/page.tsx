'use client';

import Link from 'next/link';
import {useParams} from 'next/navigation';
import {useEffect, useState} from 'react';
import {Timestamp, doc, onSnapshot} from 'firebase/firestore';
import {getFirestoreInstance} from '@zerebro/shared-firebase';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type {ClassReportTopicStat} from '@zerebro/shared-types';

import {useOwnSchool} from '@/lib/ownSchool';
import {useClassCoverage} from '@/lib/schoolReports';
import {daysAgoInSchoolTz} from '@/lib/schoolTime';

interface ClassDoc {
  grade?: number;
  section?: string;
  className?: string;
  academicYear?: string;
  teacherIds?: string[];
  studentChildUids?: string[];
  createdAt?: Timestamp;
}

export default function ClassDetailPage() {
  const own = useOwnSchool();
  const params = useParams<{classId: string}>();
  const classId = params?.classId ?? '';

  const [klass, setKlass] = useState<ClassDoc | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!own.schoolId || !classId) return;
    const unsub = onSnapshot(
      doc(
        getFirestoreInstance(),
        'schools',
        own.schoolId,
        'classes',
        classId,
      ),
      snap => setKlass(snap.exists() ? (snap.data() as ClassDoc) : null),
      err => setError(err.message),
    );
    return unsub;
  }, [own.schoolId, classId]);

  if (own.loading || klass === undefined) {
    return <p className="text-sm text-text-muted">Loading…</p>;
  }
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
  if (!own.schoolId || klass === null) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-8 text-center">
        <p className="text-sm text-text-muted">Class not found.</p>
        <Link
          href="/classes"
          className="mt-3 inline-block text-sm text-primary hover:underline"
        >
          Back to classes
        </Link>
      </div>
    );
  }

  return (
    <main className="flex flex-col gap-6">
      <header className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-text-muted">
            Class
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-text">
            {klass.className ?? `${klass.grade ?? ''}${klass.section ?? ''}`}
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            Grade {klass.grade} · Section {klass.section} · {klass.academicYear}
          </p>
        </div>
        <Link href="/classes" className="text-sm text-text-muted hover:text-text">
          &larr; All classes
        </Link>
      </header>

      <section className="rounded-2xl border border-border bg-surface p-6">
        <h2 className="text-lg font-semibold text-text">Overview</h2>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="rounded-xl border border-border bg-bg p-4">
            <p className="text-xs uppercase tracking-widest text-text-muted">Teachers</p>
            <p className="mt-1 text-2xl font-semibold text-text">
              {klass.teacherIds?.length ?? 0}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-bg p-4">
            <p className="text-xs uppercase tracking-widest text-text-muted">Students</p>
            <p className="mt-1 text-2xl font-semibold text-text">
              {klass.studentChildUids?.length ?? 0}
            </p>
          </div>
        </div>
      </section>

      <CoverageSection schoolId={own.schoolId} classId={classId} />

      {error ? (
        <p
          role="alert"
          className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
        >
          {error}
        </p>
      ) : null}
    </main>
  );
}

function CoverageSection({
  schoolId,
  classId,
}: {
  schoolId: string;
  classId: string;
}) {
  const coverage = useClassCoverage(schoolId, classId);
  const detail = coverage.data;
  const staleDays = detail?.reportDate
    ? daysAgoInSchoolTz(detail.reportDate)
    : null;

  return (
    <section className="rounded-2xl border border-border bg-surface p-6">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold text-text">Topic coverage</h2>
        {detail?.reportDate ? (
          <span className="text-xs text-text-muted">
            as of {detail.reportDate}
            {staleDays !== null && staleDays > 0
              ? ` (${staleDays}d ago)`
              : ''}
          </span>
        ) : null}
      </div>

      {coverage.error ? (
        <p
          role="alert"
          className="mt-4 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
        >
          {coverage.error}
        </p>
      ) : coverage.loading || detail === null ? (
        <p className="mt-4 text-sm text-text-muted">Loading coverage…</p>
      ) : (
        <div className="mt-4 flex flex-col gap-6">
          {detail.topics.length === 0 ? (
            <p className="text-sm text-text-muted">
              No quiz activity in the latest report yet.
            </p>
          ) : (
            <TopicCoverageChart topics={detail.topics} />
          )}

          <div className="border-t border-border pt-6">
            <h3 className="text-sm font-medium text-text">Assigned topics</h3>
            {detail.assignedTopics.length === 0 ? (
              <p className="mt-2 text-sm text-text-muted">
                No topics assigned to this class yet.
              </p>
            ) : (
              <ul className="mt-2 flex flex-col gap-2">
                {detail.assignedTopics.map(t => (
                  <li
                    key={t.topicId}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border bg-bg px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-text">
                        {t.topicName}
                      </p>
                      <p className="text-xs text-text-muted">
                        {t.subjectName ? `${t.subjectName} · ` : ''}assigned{' '}
                        {t.lastAssignedDate || '—'}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-widest ${
                        t.hasActivity
                          ? 'bg-success/10 text-success'
                          : 'border border-border text-text-muted'
                      }`}
                    >
                      {t.hasActivity ? 'Active' : 'No attempts'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Topic coverage visualization
// ---------------------------------------------------------------------------

/**
 * Chart palette. Hard-coded hex mirrors the CSS custom properties in
 * `globals.css` (--color-success, etc.) because recharts renders raw SVG
 * attributes and can't read Tailwind utility classes.
 */
const CHART = {
  success: '#4ade80',
  warning: '#facc15',
  danger: '#f87171',
  grid: '#334155',
  axis: '#94a3b8',
  text: '#f8fafc',
} as const;

function bandColor(pct: number): string {
  if (pct >= 70) return CHART.success;
  if (pct >= 40) return CHART.warning;
  return CHART.danger;
}

function bandTextClass(pct: number): string {
  if (pct >= 70) return 'text-success';
  if (pct >= 40) return 'text-warning';
  return 'text-danger';
}

interface SubjectGroup {
  subjectName: string;
  topics: ClassReportTopicStat[];
  /** Mean of the group's topic averages, weakest groups surfaced first. */
  avg: number;
}

interface ChartDatum {
  name: string;
  value: number;
  caption: string;
}

function groupTopicsBySubject(topics: ClassReportTopicStat[]): SubjectGroup[] {
  const bySubject = new Map<string, ClassReportTopicStat[]>();
  for (const t of topics) {
    const key = t.subjectName || 'Other';
    const arr = bySubject.get(key) ?? [];
    arr.push(t);
    bySubject.set(key, arr);
  }
  const groups: SubjectGroup[] = Array.from(bySubject.entries()).map(
    ([subjectName, ts]) => ({
      subjectName,
      // Weakest topic first within each subject so the re-teach candidates lead.
      topics: [...ts].sort((a, b) => a.avgBestPercentage - b.avgBestPercentage),
      avg: ts.length
        ? Math.round(
            ts.reduce((s, t) => s + t.avgBestPercentage, 0) / ts.length,
          )
        : 0,
    }),
  );
  // Weakest subject first to draw the principal's eye to where help is needed.
  return groups.sort((a, b) => a.avg - b.avg);
}

function TopicCoverageChart({topics}: {topics: ClassReportTopicStat[]}) {
  const groups = groupTopicsBySubject(topics);

  const subjectData: ChartDatum[] = groups.map(g => ({
    name: g.subjectName,
    value: g.avg,
    caption: `${g.topics.length} topic${g.topics.length === 1 ? '' : 's'}`,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-text-muted">
        <LegendDot color={CHART.success} label="Strong (70%+)" />
        <LegendDot color={CHART.warning} label="Needs work (40–69%)" />
        <LegendDot color={CHART.danger} label="Weak (below 40%)" />
      </div>

      {/* Cross-subject comparison — only useful when there's more than one. */}
      {groups.length > 1 ? (
        <div className="rounded-xl border border-border bg-bg p-4">
          <h4 className="text-xs font-semibold uppercase tracking-widest text-text-muted">
            Average score by subject
          </h4>
          <div className="mt-3">
            <ScoreBarChart data={subjectData} labelWidth={96} />
          </div>
        </div>
      ) : null}

      {/* Per-subject topic breakdown. */}
      {groups.map(group => (
        <div
          key={group.subjectName}
          className="rounded-xl border border-border bg-bg p-4"
        >
          <div className="flex items-baseline justify-between gap-2">
            <h4 className="text-sm font-semibold capitalize text-text">
              {group.subjectName}
            </h4>
            <span className="text-xs text-text-muted">
              {group.topics.length} topic{group.topics.length === 1 ? '' : 's'} ·
              avg{' '}
              <span className={`font-semibold ${bandTextClass(group.avg)}`}>
                {group.avg}%
              </span>
            </span>
          </div>
          <div className="mt-3">
            <ScoreBarChart
              data={group.topics.map(t => ({
                name: t.topicName,
                value: t.avgBestPercentage,
                caption: `${t.passedStudents} of ${t.attemptedStudents} passed`,
              }))}
              labelWidth={150}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Horizontal bar chart (recharts) used for both the subject overview and each
 * subject's topic breakdown. Bars are colored by score band, the X axis is a
 * fixed 0-100% scale with gridlines so bars across different charts are
 * directly comparable, and each bar carries its percentage label.
 */
function ScoreBarChart({
  data,
  labelWidth,
}: {
  data: ChartDatum[];
  labelWidth: number;
}) {
  const ROW_HEIGHT = 34;
  const height = Math.max(96, data.length * ROW_HEIGHT + 28);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{top: 4, right: 40, bottom: 4, left: 4}}
        barCategoryGap={data.length > 1 ? '28%' : 0}
      >
        <CartesianGrid horizontal={false} stroke={CHART.grid} strokeDasharray="3 3" />
        <XAxis
          type="number"
          domain={[0, 100]}
          ticks={[0, 25, 50, 75, 100]}
          tickFormatter={v => `${v}%`}
          stroke={CHART.axis}
          fontSize={11}
          tickLine={false}
          axisLine={{stroke: CHART.grid}}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={labelWidth}
          stroke={CHART.axis}
          fontSize={12}
          tickLine={false}
          axisLine={false}
          interval={0}
          tickFormatter={(v: string) =>
            v.length > 22 ? `${v.slice(0, 21)}…` : v
          }
        />
        <Tooltip
          cursor={{fill: 'rgba(148,163,184,0.08)'}}
          content={<ChartTooltip />}
        />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={22} barSize={18}>
          {data.map(d => (
            <Cell key={d.name} fill={bandColor(d.value)} />
          ))}
          <LabelList
            dataKey="value"
            position="right"
            formatter={(v: unknown) => `${v ?? 0}%`}
            fill={CHART.text}
            fontSize={11}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

interface TooltipPayload {
  payload: ChartDatum;
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-lg">
      <p className="font-medium text-text">{d.name}</p>
      <p className={`font-semibold ${bandTextClass(d.value)}`}>
        Avg {d.value}%
      </p>
      <p className="text-text-muted">{d.caption}</p>
    </div>
  );
}

function LegendDot({color, label}: {color: string; label: string}) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="h-2.5 w-2.5 rounded-full"
        style={{backgroundColor: color}}
      />
      {label}
    </span>
  );
}
