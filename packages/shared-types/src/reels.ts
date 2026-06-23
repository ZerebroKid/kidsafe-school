/**
 * Reels feature types.
 *
 * Three Firestore collections:
 *   - `reelsCatalog/{reelId}`  — admin-seeded video catalogue
 *   - `reelTopics/{topicTag}`  — per-topic metadata + parent questions
 *   - `children/{childUid}/reelInsights/{YYYY-MM-DD}` — daily watch-time rollup
 *
 * Written by the ZKid (child) app; read by the ZConnect (parent) app.
 * Security rules mirror the `usageDaily` pattern: child writes, parent reads.
 */

import type {FirestoreFieldValueLike} from './firestore';

/**
 * `reelsCatalog/{reelId}` — one doc per video in the feed.
 * Seeded from `content/reels/*.json` via `seedReels.ts`.
 */
export interface ReelDoc {
  reelId: string;
  videoUrl: string;
  thumbnailUrl?: string;
  title: string;
  /** `topic` reels are tracked for parent insights; `fun` reels are engagement filler. */
  kind: 'topic' | 'fun';
  /** Links this reel to a curriculum topic. Required when `kind === 'topic'`. */
  topicTag?: string;
  subject?: string;
  /** Grades this reel is appropriate for (e.g. [1,2,3] for class 1-3). */
  gradeBand: number[];
  /** Expected duration in seconds (informational; actual watch time is measured). */
  durationSec: number;
  active: boolean;
  createdAt: FirestoreFieldValueLike;
}

/**
 * `reelTopics/{topicTag}` — metadata for a topic that has reels.
 * The `parentQuestions` are surfaced in the parent app as
 * "Ask your child these questions tonight".
 */
export interface ReelTopicDoc {
  topicTag: string;
  name: string;
  subject: string;
  parentQuestions: string[];
}

/**
 * Per-topic watch data inside a `ReelInsightDoc.perTopic` map.
 */
export interface ReelTopicInsight {
  name: string;
  watchedMs: number;
  viewCount: number;
}

/**
 * `children/{childUid}/reelInsights/{YYYY-MM-DD}` — daily rollup of
 * how long the child watched topic reels, keyed by topic tag.
 *
 * Mirrors the `UsageDailyDoc` pattern: one doc per day, child writes
 * via `FieldValue.increment`, parent reads under `isParentOf`.
 */
export interface ReelInsightDoc {
  date: string;
  totalWatchedMs: number;
  perTopic: Record<string, ReelTopicInsight>;
  updatedAt: FirestoreFieldValueLike;
}
