'use client';

import {useEffect, useState} from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import {getAuthInstance, getFirestoreInstance} from '@zerebro/shared-firebase';

/*
 * P4.10.1 -- admin reward catalogue CRUD + moderation.
 *
 * `rewardCatalog/{id}` is the pool the `onQuizAttemptWrite` trigger draws from
 * when a child passes a quiz. Eligibility (locked MVP decision) is
 * `moderationStatus == 'approved'` + `subjectTags array-contains <subject>`,
 * so the two fields that matter most are the moderation status and the
 * (lowercased) subject tags.
 *
 * Writes here are gated by firestore.rules `match /rewardCatalog` -> admin
 * only. New rewards are created `pending`; an admin must explicitly approve
 * before the trigger will ever pick them. `subjectTags` are normalised to
 * lowercase on create so the trigger's lowercased `array-contains` lookup
 * matches.
 */

type RewardType = 'youtube_link' | 'game_link' | 'article_link';
type ModerationStatus = 'pending' | 'approved' | 'rejected';

interface RewardRow {
  id: string;
  type?: RewardType;
  title?: string;
  url?: string;
  subjectTags?: string[];
  grades?: number[];
  moderationStatus?: ModerationStatus;
  approvedBy?: string | null;
  createdAt?: Timestamp;
}

const REWARD_TYPES: {value: RewardType; label: string}[] = [
  {value: 'youtube_link', label: 'YouTube video'},
  {value: 'game_link', label: 'Game link'},
  {value: 'article_link', label: 'Article link'},
];

const ALL_GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export default function AdminRewardsPage() {
  const [rows, setRows] = useState<RewardRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // --- create form state ---
  const [type, setType] = useState<RewardType>('youtube_link');
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [tags, setTags] = useState('');
  const [grades, setGrades] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // --- edit modal state ---
  const [editId, setEditId] = useState<string | null>(null);
  const [editType, setEditType] = useState<RewardType>('youtube_link');
  const [editTitle, setEditTitle] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editTags, setEditTags] = useState('');
  const [editGrades, setEditGrades] = useState<number[]>([]);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  function toggleGrade(g: number) {
    setGrades(prev =>
      prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g].sort((a, b) => a - b),
    );
  }

  function toggleEditGrade(g: number) {
    setEditGrades(prev =>
      prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g].sort((a, b) => a - b),
    );
  }

  function openEdit(r: RewardRow) {
    setEditId(r.id);
    setEditType(r.type ?? 'youtube_link');
    setEditTitle(r.title ?? '');
    setEditUrl(r.url ?? '');
    setEditTags(r.subjectTags?.length ? r.subjectTags.join(', ') : '');
    setEditGrades(r.grades ?? []);
    setEditError(null);
  }

  function closeEdit() {
    if (editSaving) return;
    setEditId(null);
  }

  const editParsedTags = editTags
    .split(',')
    .map(t => t.trim().toLowerCase())
    .filter(Boolean);

  const canSaveEdit =
    editTitle.trim().length >= 2 &&
    editUrl.trim().length > 0 &&
    editParsedTags.length > 0 &&
    editGrades.length > 0;

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editId || !canSaveEdit || editSaving) return;
    setEditSaving(true);
    setEditError(null);
    try {
      // Editing re-approves the reward: the admin reviewed the latest fields,
      // so we stamp it approved (by the current admin) on save.
      const uid = getAuthInstance().currentUser?.uid ?? null;
      await updateDoc(doc(getFirestoreInstance(), 'rewardCatalog', editId), {
        type: editType,
        title: editTitle.trim(),
        url: editUrl.trim(),
        subjectTags: editParsedTags,
        grades: editGrades,
        moderationStatus: 'approved',
        approvedBy: uid,
      });
      setEditId(null);
    } catch (err) {
      setEditError((err as {message?: string} | null)?.message ?? 'Update failed.');
    } finally {
      setEditSaving(false);
    }
  }

  useEffect(() => {
    const q = query(
      collection(getFirestoreInstance(), 'rewardCatalog'),
      orderBy('createdAt', 'desc'),
    );
    const unsub = onSnapshot(
      q,
      snap => {
        setRows(
          snap.docs.map(d => ({
            id: d.id,
            ...(d.data() as Omit<RewardRow, 'id'>),
          })),
        );
        setError(null);
      },
      err => {
        setError(err.message);
        // Clear the null "loading" sentinel so the UI shows the error banner +
        // empty state instead of spinning on "Loading…" forever.
        setRows([]);
      },
    );
    return unsub;
  }, []);

  const parsedTags = tags
    .split(',')
    .map(t => t.trim().toLowerCase())
    .filter(Boolean);

  const canSubmit =
    title.trim().length >= 2 &&
    url.trim().length > 0 &&
    parsedTags.length > 0 &&
    grades.length > 0;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await addDoc(collection(getFirestoreInstance(), 'rewardCatalog'), {
        type,
        title: title.trim(),
        url: url.trim(),
        subjectTags: parsedTags,
        grades,
        moderationStatus: 'pending',
        approvedBy: null,
        createdAt: serverTimestamp(),
      });
      setTitle('');
      setUrl('');
      setTags('');
      setGrades([]);
      setType('youtube_link');
    } catch (err) {
      setError((err as {message?: string} | null)?.message ?? 'Create failed.');
    } finally {
      setSubmitting(false);
    }
  }

  async function setStatus(id: string, status: ModerationStatus) {
    setBusyId(id);
    setError(null);
    try {
      const uid = getAuthInstance().currentUser?.uid ?? null;
      await updateDoc(doc(getFirestoreInstance(), 'rewardCatalog', id), {
        moderationStatus: status,
        approvedBy: status === 'approved' ? uid : null,
      });
    } catch (err) {
      setError((err as {message?: string} | null)?.message ?? 'Update failed.');
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    setBusyId(id);
    setError(null);
    try {
      await deleteDoc(doc(getFirestoreInstance(), 'rewardCatalog', id));
    } catch (err) {
      setError((err as {message?: string} | null)?.message ?? 'Delete failed.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="flex flex-col gap-6">
      <header>
        <p className="text-xs uppercase tracking-widest text-text-muted">
          Rewards
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-text">
          Reward catalogue
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          Approved rewards are unlocked for a child when they pass a quiz whose
          subject matches a reward&apos;s tags.
        </p>
      </header>

      {error ? (
        <p
          role="alert"
          className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
        >
          {error}
        </p>
      ) : null}

      <form
        onSubmit={handleCreate}
        className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5"
      >
        <p className="text-sm font-medium text-text">Add a reward</p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-text-muted">Type</span>
            <select
              value={type}
              onChange={e => setType(e.target.value as RewardType)}
              disabled={submitting}
              className="rounded-lg border border-border bg-bg px-3 py-2 text-text outline-none focus:border-primary"
            >
              {REWARD_TYPES.map(t => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-text-muted">
              Subject tags (comma-separated)
            </span>
            <input
              type="text"
              value={tags}
              onChange={e => setTags(e.target.value)}
              placeholder="e.g. science, maths"
              disabled={submitting}
              className="rounded-lg border border-border bg-bg px-3 py-2 text-text outline-none focus:border-primary"
            />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-text-muted">Title</span>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Fun science experiment video"
            disabled={submitting}
            className="rounded-lg border border-border bg-bg px-3 py-2 text-text outline-none focus:border-primary"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-text-muted">URL</span>
          <input
            type="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://youtube.com/watch?v=…"
            disabled={submitting}
            className="rounded-lg border border-border bg-bg px-3 py-2 text-text outline-none focus:border-primary"
          />
        </label>
        <div className="flex flex-col gap-2 text-sm">
          <span className="text-text-muted">
            Grades (the reward only unlocks for these grades)
          </span>
          <div className="flex flex-wrap gap-2">
            {ALL_GRADES.map(g => {
              const selected = grades.includes(g);
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() => toggleGrade(g)}
                  disabled={submitting}
                  aria-pressed={selected}
                  className={
                    'h-9 w-12 rounded-lg border text-sm font-medium transition-colors disabled:opacity-60 ' +
                    (selected
                      ? 'border-primary bg-primary text-primary-text'
                      : 'border-border bg-bg text-text hover:border-primary/60')
                  }
                >
                  {g}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!canSubmit || submitting}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-text disabled:opacity-60"
          >
            {submitting ? 'Adding…' : 'Add reward'}
          </button>
        </div>
      </form>

      {rows === null ? (
        <p className="text-sm text-text-muted">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface p-8 text-center">
          <p className="text-sm text-text-muted">
            No rewards yet. Add a few above, then approve them so kids can
            unlock them.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase tracking-widest text-text-muted">
              <tr>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Subjects</th>
                <th className="px-4 py-3">Grades</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const status = r.moderationStatus ?? 'pending';
                const busy = busyId === r.id;
                return (
                  <tr
                    key={r.id}
                    className="border-b border-border last:border-0 text-text"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium">{r.title ?? '—'}</div>
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-primary hover:underline"
                      >
                        {r.url}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-text-muted">
                      {r.type ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-text-muted">
                      {r.subjectTags?.length ? r.subjectTags.join(', ') : '—'}
                    </td>
                    <td className="px-4 py-3 text-text-muted">
                      {r.grades?.length ? r.grades.join(', ') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={
                          'rounded-full px-2 py-0.5 text-xs ' +
                          (status === 'approved'
                            ? 'bg-success/15 text-success'
                            : status === 'rejected'
                              ? 'bg-danger/15 text-danger'
                              : 'bg-warning/15 text-warning')
                        }
                      >
                        {status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(r)}
                          disabled={busy}
                          className="rounded-lg border border-border px-3 py-1 text-xs text-text disabled:opacity-50"
                        >
                          Edit
                        </button>
                        {status !== 'approved' ? (
                          <button
                            type="button"
                            onClick={() => setStatus(r.id, 'approved')}
                            disabled={busy}
                            className="rounded-lg border border-success/40 px-3 py-1 text-xs text-success disabled:opacity-50"
                          >
                            Approve
                          </button>
                        ) : null}
                        {status !== 'rejected' ? (
                          <button
                            type="button"
                            onClick={() => setStatus(r.id, 'rejected')}
                            disabled={busy}
                            className="rounded-lg border border-border px-3 py-1 text-xs text-text-muted disabled:opacity-50"
                          >
                            Reject
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => remove(r.id)}
                          disabled={busy}
                          className="rounded-lg border border-danger/40 px-3 py-1 text-xs text-danger disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editId ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={e => {
            if (e.target === e.currentTarget) closeEdit();
          }}
        >
          <form
            onSubmit={handleUpdate}
            className="flex max-h-[90vh] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-2xl border border-border bg-surface p-6"
          >
            <div>
              <h2 className="text-lg font-semibold text-text">Edit reward</h2>
              <p className="mt-1 text-xs text-text-muted">
                Saving re-approves this reward with the latest details.
              </p>
            </div>

            {editError ? (
              <p
                role="alert"
                className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
              >
                {editError}
              </p>
            ) : null}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-text-muted">Type</span>
                <select
                  value={editType}
                  onChange={e => setEditType(e.target.value as RewardType)}
                  disabled={editSaving}
                  className="rounded-lg border border-border bg-bg px-3 py-2 text-text outline-none focus:border-primary"
                >
                  {REWARD_TYPES.map(t => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-text-muted">
                  Subject tags (comma-separated)
                </span>
                <input
                  type="text"
                  value={editTags}
                  onChange={e => setEditTags(e.target.value)}
                  placeholder="e.g. science, maths"
                  disabled={editSaving}
                  className="rounded-lg border border-border bg-bg px-3 py-2 text-text outline-none focus:border-primary"
                />
              </label>
            </div>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-text-muted">Title</span>
              <input
                type="text"
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                placeholder="e.g. Fun science experiment video"
                disabled={editSaving}
                className="rounded-lg border border-border bg-bg px-3 py-2 text-text outline-none focus:border-primary"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-text-muted">URL</span>
              <input
                type="url"
                value={editUrl}
                onChange={e => setEditUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=…"
                disabled={editSaving}
                className="rounded-lg border border-border bg-bg px-3 py-2 text-text outline-none focus:border-primary"
              />
            </label>
            <div className="flex flex-col gap-2 text-sm">
              <span className="text-text-muted">
                Grades (the reward only unlocks for these grades)
              </span>
              <div className="flex flex-wrap gap-2">
                {ALL_GRADES.map(g => {
                  const selected = editGrades.includes(g);
                  return (
                    <button
                      key={g}
                      type="button"
                      onClick={() => toggleEditGrade(g)}
                      disabled={editSaving}
                      aria-pressed={selected}
                      className={
                        'h-9 w-12 rounded-lg border text-sm font-medium transition-colors disabled:opacity-60 ' +
                        (selected
                          ? 'border-primary bg-primary text-primary-text'
                          : 'border-border bg-bg text-text hover:border-primary/60')
                      }
                    >
                      {g}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closeEdit}
                disabled={editSaving}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-text disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!canSaveEdit || editSaving}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-text disabled:opacity-60"
              >
                {editSaving ? 'Saving…' : 'Update & approve'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </main>
  );
}
