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
  moderationStatus?: ModerationStatus;
  approvedBy?: string | null;
  createdAt?: Timestamp;
}

const REWARD_TYPES: {value: RewardType; label: string}[] = [
  {value: 'youtube_link', label: 'YouTube video'},
  {value: 'game_link', label: 'Game link'},
  {value: 'article_link', label: 'Article link'},
];

export default function AdminRewardsPage() {
  const [rows, setRows] = useState<RewardRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // --- create form state ---
  const [type, setType] = useState<RewardType>('youtube_link');
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [tags, setTags] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
    title.trim().length >= 2 && url.trim().length > 0 && parsedTags.length > 0;

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
        moderationStatus: 'pending',
        approvedBy: null,
        createdAt: serverTimestamp(),
      });
      setTitle('');
      setUrl('');
      setTags('');
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
    </main>
  );
}
