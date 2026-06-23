/**
 * Watch-time tracker for the Reels feed.
 *
 * Accumulates milliseconds of actual playback per topic reel and flushes
 * the accumulated data to Firestore via `bumpReelInsight` on:
 *   - reel change (carousel snap)
 *   - screen blur / unmount
 *   - explicit `flush()` call
 *
 * Only accrues time when:
 *   1. The reel is the active carousel item
 *   2. The video is playing (progress ticks arriving)
 *   3. The reel is a `topic` kind (fun reels are not tracked)
 *
 * Protections:
 *   - Ignores progress deltas > 5s (catches seeks / video restarts)
 *   - Debounces flush so rapid swiping doesn't create write storms
 */

import auth from '@react-native-firebase/auth';

import {bumpReelInsight, formatDateKey} from '@zerebro/shared-firebase/firestore';
import type {ReelDoc} from '@zerebro/shared-types';

const MAX_DELTA_SEC = 5;
const MIN_FLUSH_MS = 500;

interface Accumulator {
  topicTag: string;
  topicName: string;
  watchedMs: number;
  views: number;
}

export class WatchTracker {
  private activeReel: ReelDoc | null = null;
  private lastProgressSec = 0;
  private accumulated = new Map<string, Accumulator>();
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Called when the carousel snaps to a new reel. Flushes any pending
   * data for the previous reel, then starts tracking the new one.
   */
  setActiveReel(reel: ReelDoc) {
    this.activeReel = reel;
    this.lastProgressSec = 0;

    if (reel.kind === 'topic' && reel.topicTag) {
      const existing = this.accumulated.get(reel.topicTag);
      if (existing) {
        existing.views += 1;
      } else {
        this.accumulated.set(reel.topicTag, {
          topicTag: reel.topicTag,
          topicName: reel.title,
          watchedMs: 0,
          views: 1,
        });
      }
    }
  }

  /**
   * Called from `react-native-video`'s `onProgress` callback (every 250ms).
   * `currentTimeSec` is `data.currentTime` from the video player.
   */
  onProgress(currentTimeSec: number) {
    if (!this.activeReel) return;
    if (this.activeReel.kind !== 'topic' || !this.activeReel.topicTag) return;

    if (this.lastProgressSec > 0) {
      const deltaSec = currentTimeSec - this.lastProgressSec;
      if (deltaSec > 0 && deltaSec < MAX_DELTA_SEC) {
        const deltaMs = Math.round(deltaSec * 1000);
        const acc = this.accumulated.get(this.activeReel.topicTag);
        if (acc) {
          acc.watchedMs += deltaMs;
        }
      }
    }
    this.lastProgressSec = currentTimeSec;
  }

  /**
   * Flush accumulated watch data to Firestore. Safe to call multiple times;
   * only writes if there is data to flush.
   */
  flush() {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    const uid = auth().currentUser?.uid;
    if (!uid) return;

    const today = formatDateKey(new Date());
    const entries = Array.from(this.accumulated.values()).filter(
      a => a.watchedMs >= MIN_FLUSH_MS,
    );

    if (entries.length === 0) return;

    for (const entry of entries) {
      bumpReelInsight(
        uid,
        today,
        entry.topicTag,
        entry.topicName,
        entry.watchedMs,
        entry.views,
      ).catch(err =>
        console.warn('[Reels][WatchTracker] flush error', err),
      );
    }

    this.accumulated.clear();
  }

  /** Schedule a debounced flush (e.g. after rapid swipes). */
  scheduleDebouncedFlush(delayMs = 2000) {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flush();
    }, delayMs);
  }
}
