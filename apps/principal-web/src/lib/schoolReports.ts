'use client';

/*
 * P5.2/P5.3 -- principal dashboard data layer.
 *
 * Reads the pre-aggregated `classReports` the nightly cron writes
 * (apps/functions/src/crons/aggregateClassReports.ts) plus the raw
 * `studyAssignments` for assigned-topic coverage and teacher activity.
 *
 * Design notes:
 *   - Load-once (`getDocs`/`getDoc`), not `onSnapshot`: reports change once a
 *     night, so a single fetch keeps the dashboard under the <1s target with no
 *     listener churn. Pages re-run the hook when `schoolId` resolves.
 *   - Each coverage card uses the LATEST snapshot per class: pointer doc
 *     `classReports/{classId}.lastDailyDate` -> `daily/{lastDailyDate}`.
 *   - Firestore rules gate `classReports`/`studyAssignments` reads on the
 *     principal belonging to `resource.data.schoolId`; the queries here always
 *     constrain `schoolId == ownSchoolId` so they pass "rules are not filters".
 *   - Equality-only queries use automatic single-field indexes (no composite).
 */

import {useEffect, useState} from 'react';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import {getFirestoreInstance} from '@zerebro/shared-firebase';
import type {
  ClassReportDailyDoc,
  ClassReportPointerDoc,
  ClassReportTopicStat,
} from '@zerebro/shared-types';

export interface HookState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

const INITIAL: HookState<never> = {data: null, loading: true, error: null};

function errMessage(err: unknown): string {
  return (err as {message?: string} | null)?.message ?? 'Read failed.';
}

// ---------------------------------------------------------------------------
// studyAssignments
// ---------------------------------------------------------------------------

export interface AssignmentRow {
  id: string;
  classId: string;
  topicId: string;
  topicName: string;
  subjectName: string;
  assignedByTeacherUid: string;
  assignedByTeacherDisplayName?: string;
  /** `YYYY-MM-DD` in the school timezone. */
  assignedDate: string;
}

function mapAssignment(id: string, d: Record<string, unknown>): AssignmentRow {
  const s = (v: unknown): string => (typeof v === 'string' ? v : '');
  return {
    id,
    classId: s(d.classId),
    topicId: s(d.topicId),
    topicName: s(d.topicName) || s(d.topicId),
    subjectName: s(d.subjectName),
    assignedByTeacherUid: s(d.assignedByTeacherUid),
    ...(typeof d.assignedByTeacherDisplayName === 'string'
      ? {assignedByTeacherDisplayName: d.assignedByTeacherDisplayName}
      : {}),
    assignedDate: s(d.assignedDate),
  };
}

async function fetchSchoolAssignments(schoolId: string): Promise<AssignmentRow[]> {
  const snap = await getDocs(
    query(
      collection(getFirestoreInstance(), 'studyAssignments'),
      where('schoolId', '==', schoolId),
    ),
  );
  return snap.docs.map(d => mapAssignment(d.id, d.data() as Record<string, unknown>));
}

/** All `studyAssignments` for the school. Shared by dashboard + teachers page. */
export function useSchoolAssignments(
  schoolId: string | null,
): HookState<AssignmentRow[]> {
  const [state, setState] = useState<HookState<AssignmentRow[]>>(INITIAL);

  useEffect(() => {
    if (!schoolId) {
      setState({data: null, loading: false, error: null});
      return;
    }
    let cancelled = false;
    setState(INITIAL);
    fetchSchoolAssignments(schoolId)
      .then(rows => {
        if (!cancelled) setState({data: rows, loading: false, error: null});
      })
      .catch(err => {
        if (!cancelled)
          setState({data: null, loading: false, error: errMessage(err)});
      });
    return () => {
      cancelled = true;
    };
  }, [schoolId]);

  return state;
}

// ---------------------------------------------------------------------------
// classReports coverage
// ---------------------------------------------------------------------------

export interface ClassCoverage {
  classId: string;
  className: string;
  grade: number | null;
  section: string;
  rosterSize: number;
  /** `lastDailyDate` of the report shown, or null when no report exists. */
  reportDate: string | null;
  attemptedStudents: number;
  passedStudents: number;
  avgBestPercentage: number | null;
  /** Distinct topics ever assigned to this class (cumulative). */
  assignedTopicsTotal: number;
  /** Per-topic stats from the latest daily report (weakest-first). */
  topics: ClassReportTopicStat[];
}

interface ClassListEntry {
  id: string;
  grade: number | null;
  section: string;
  className: string;
  rosterSize: number;
}

async function fetchClasses(schoolId: string): Promise<ClassListEntry[]> {
  const snap = await getDocs(
    collection(getFirestoreInstance(), 'schools', schoolId, 'classes'),
  );
  return snap.docs.map(d => {
    const data = d.data() as Record<string, unknown>;
    const grade = typeof data.grade === 'number' ? data.grade : null;
    const section = typeof data.section === 'string' ? data.section : '';
    const className =
      typeof data.className === 'string' && data.className.length > 0
        ? data.className
        : `${grade ?? ''}${section}`;
    const rosterSize = Array.isArray(data.studentChildUids)
      ? data.studentChildUids.filter(u => typeof u === 'string').length
      : 0;
    return {id: d.id, grade, section, className, rosterSize};
  });
}

/**
 * Fetch all pointer docs for the school's classes in a single query. Returns a
 * map of `classId -> pointer data`. Uses `where('schoolId','==',schoolId)` so
 * the query only returns EXISTING docs and satisfies the Firestore rule
 * `belongsToSchool(resource.data.schoolId)`.
 *
 * This avoids the per-class `getDoc` that fails with permission-denied when the
 * pointer doc doesn't exist (Firestore evaluates rules on missing docs, and
 * `resource.data.schoolId` is null, failing the principal branch).
 */
async function fetchPointersBySchool(
  schoolId: string,
): Promise<Map<string, Partial<ClassReportPointerDoc>>> {
  const snap = await getDocs(
    query(
      collection(getFirestoreInstance(), 'classReports'),
      where('schoolId', '==', schoolId),
    ),
  );
  const map = new Map<string, Partial<ClassReportPointerDoc>>();
  for (const d of snap.docs) {
    map.set(d.id, d.data() as Partial<ClassReportPointerDoc>);
  }
  return map;
}

/**
 * Fetch the latest daily report for a class given its pointer data. Returns
 * null when the pointer is missing or has no `lastDailyDate`. The daily doc
 * read is a `getDoc` on a doc that IS expected to exist (the cron wrote it),
 * so the rule evaluates against real data.
 */
async function fetchDailyFromPointer(
  classId: string,
  pointer: Partial<ClassReportPointerDoc> | undefined,
): Promise<ClassReportDailyDoc | null> {
  if (!pointer) return null;
  const lastDailyDate = pointer.lastDailyDate;
  if (typeof lastDailyDate !== 'string' || lastDailyDate.length === 0) {
    return null;
  }
  const dailySnap = await getDoc(
    doc(getFirestoreInstance(), 'classReports', classId, 'daily', lastDailyDate),
  );
  if (!dailySnap.exists()) return null;
  return dailySnap.data() as ClassReportDailyDoc;
}

function distinctAssignedTopics(
  assignments: AssignmentRow[],
  classId: string,
): number {
  const set = new Set<string>();
  for (const a of assignments) {
    if (a.classId === classId && a.topicId) set.add(a.topicId);
  }
  return set.size;
}

function mergeCoverage(
  klass: ClassListEntry,
  report: ClassReportDailyDoc | null,
  assignedTopicsTotal: number,
): ClassCoverage {
  return {
    classId: klass.id,
    className: klass.className,
    grade: klass.grade,
    section: klass.section,
    // The class doc roster is the source of truth; fall back to the report's
    // snapshot if the class doc somehow lacked the array.
    rosterSize: klass.rosterSize || report?.rosterSize || 0,
    reportDate: report?.date ?? null,
    attemptedStudents: report?.attemptedStudents ?? 0,
    passedStudents: report?.passedStudents ?? 0,
    avgBestPercentage:
      report && typeof report.avgBestPercentage === 'number'
        ? report.avgBestPercentage
        : null,
    assignedTopicsTotal,
    topics: Array.isArray(report?.topics) ? report.topics : [],
  };
}

async function fetchSchoolCoverage(schoolId: string): Promise<ClassCoverage[]> {
  const [classes, assignments, pointers] = await Promise.all([
    fetchClasses(schoolId),
    fetchSchoolAssignments(schoolId),
    fetchPointersBySchool(schoolId),
  ]);
  // Only fetch daily docs for classes that have a pointer (i.e. the cron
  // actually produced data). Classes missing from the pointer map are simply
  // "No activity yet" — no failed read, no permission error.
  const reports = await Promise.all(
    classes.map(c => fetchDailyFromPointer(c.id, pointers.get(c.id))),
  );
  return classes.map((c, i) =>
    mergeCoverage(c, reports[i], distinctAssignedTopics(assignments, c.id)),
  );
}

/** Per-class coverage cards for the dashboard. */
export function useSchoolCoverage(
  schoolId: string | null,
): HookState<ClassCoverage[]> {
  const [state, setState] = useState<HookState<ClassCoverage[]>>(INITIAL);

  useEffect(() => {
    if (!schoolId) {
      setState({data: null, loading: false, error: null});
      return;
    }
    let cancelled = false;
    setState(INITIAL);
    fetchSchoolCoverage(schoolId)
      .then(rows => {
        if (!cancelled) setState({data: rows, loading: false, error: null});
      })
      .catch(err => {
        if (!cancelled)
          setState({data: null, loading: false, error: errMessage(err)});
      });
    return () => {
      cancelled = true;
    };
  }, [schoolId]);

  return state;
}

// ---------------------------------------------------------------------------
// single-class drill-down
// ---------------------------------------------------------------------------

export interface AssignedTopicSummary {
  topicId: string;
  topicName: string;
  subjectName: string;
  lastAssignedDate: string;
  /** Whether this assigned topic appears in the latest daily report. */
  hasActivity: boolean;
}

export interface ClassCoverageDetail {
  report: ClassReportDailyDoc | null;
  reportDate: string | null;
  topics: ClassReportTopicStat[];
  assignedTopics: AssignedTopicSummary[];
}

function buildAssignedTopics(
  assignments: AssignmentRow[],
  classId: string,
  report: ClassReportDailyDoc | null,
): AssignedTopicSummary[] {
  const activeTopicIds = new Set(
    (report?.topics ?? []).map(t => t.topicId),
  );
  const byTopic = new Map<string, AssignedTopicSummary>();
  for (const a of assignments) {
    if (a.classId !== classId || !a.topicId) continue;
    const existing = byTopic.get(a.topicId);
    if (!existing) {
      byTopic.set(a.topicId, {
        topicId: a.topicId,
        topicName: a.topicName,
        subjectName: a.subjectName,
        lastAssignedDate: a.assignedDate,
        hasActivity: activeTopicIds.has(a.topicId),
      });
    } else if (a.assignedDate > existing.lastAssignedDate) {
      existing.lastAssignedDate = a.assignedDate;
    }
  }
  return Array.from(byTopic.values()).sort((x, y) =>
    y.lastAssignedDate.localeCompare(x.lastAssignedDate),
  );
}

async function fetchClassCoverage(
  schoolId: string,
  classId: string,
): Promise<ClassCoverageDetail> {
  // Fetch the pointer via a schoolId-scoped query (same pattern as the
  // dashboard) so a missing doc returns zero results instead of a
  // permission-denied error.
  const [pointers, assignmentsSnap] = await Promise.all([
    fetchPointersBySchool(schoolId),
    getDocs(
      query(
        collection(getFirestoreInstance(), 'studyAssignments'),
        where('schoolId', '==', schoolId),
        where('classId', '==', classId),
      ),
    ),
  ]);
  const report = await fetchDailyFromPointer(classId, pointers.get(classId));
  const assignments = assignmentsSnap.docs.map(d =>
    mapAssignment(d.id, d.data() as Record<string, unknown>),
  );
  return {
    report,
    reportDate: report?.date ?? null,
    topics: Array.isArray(report?.topics) ? report.topics : [],
    assignedTopics: buildAssignedTopics(assignments, classId, report),
  };
}

/** Coverage detail (topic table + assigned topics) for one class. */
export function useClassCoverage(
  schoolId: string | null,
  classId: string | null,
): HookState<ClassCoverageDetail> {
  const [state, setState] = useState<HookState<ClassCoverageDetail>>(INITIAL);

  useEffect(() => {
    if (!schoolId || !classId) {
      setState({data: null, loading: false, error: null});
      return;
    }
    let cancelled = false;
    setState(INITIAL);
    fetchClassCoverage(schoolId, classId)
      .then(detail => {
        if (!cancelled) setState({data: detail, loading: false, error: null});
      })
      .catch(err => {
        if (!cancelled)
          setState({data: null, loading: false, error: errMessage(err)});
      });
    return () => {
      cancelled = true;
    };
  }, [schoolId, classId]);

  return state;
}

// ---------------------------------------------------------------------------
// teacher activity (derived from studyAssignments)
// ---------------------------------------------------------------------------

export interface TeacherActivity {
  lastAssignedDate: string | null;
  assignmentsThisMonth: number;
  assignmentsTotal: number;
}

/**
 * Group assignments by `assignedByTeacherUid` into per-teacher activity.
 * `monthPrefix` is `YYYY-MM` in the school timezone (computed by the caller).
 */
export function groupTeacherActivity(
  assignments: AssignmentRow[],
  monthPrefix: string,
): Record<string, TeacherActivity> {
  const out: Record<string, TeacherActivity> = {};
  for (const a of assignments) {
    if (!a.assignedByTeacherUid) continue;
    const cur =
      out[a.assignedByTeacherUid] ??
      (out[a.assignedByTeacherUid] = {
        lastAssignedDate: null,
        assignmentsThisMonth: 0,
        assignmentsTotal: 0,
      });
    cur.assignmentsTotal += 1;
    if (a.assignedDate.startsWith(monthPrefix)) cur.assignmentsThisMonth += 1;
    if (!cur.lastAssignedDate || a.assignedDate > cur.lastAssignedDate) {
      cur.lastAssignedDate = a.assignedDate || cur.lastAssignedDate;
    }
  }
  return out;
}
