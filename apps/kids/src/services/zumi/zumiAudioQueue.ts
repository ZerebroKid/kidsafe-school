/**
 * ZumiAudioQueue — sequential audio playback for streamed sentence chunks.
 *
 * Each sentence is synthesized server-side and arrives as a base64 MP3 chunk
 * via an `audio_chunk` SSE event. The queue:
 *   1. Writes each chunk to a local temp file as it arrives (non-blocking).
 *   2. Plays chunks in sequence order (seq 0, 1, 2...) using react-native-sound.
 *   3. Starts playing chunk 0 as soon as it's ready, while chunks 1..N are
 *      still being synthesized / written — this is the key TTFA optimization.
 *
 * Usage:
 *   const q = new ZumiAudioQueue();
 *   sseParser.on('audio_chunk', ({ seq, base64 }) => q.enqueue(seq, base64));
 *   sseParser.on('done', () => q.seal());     // no more chunks coming
 *   sseParser.on('error', () => q.cancel());  // abort queue
 *   await q.waitForCompletion();              // resolves when all played (or cancelled)
 */

import {playBase64} from './zumiSpeech';
import {mark} from './zumiPerf';

interface QueuedChunk {
  seq: number;
  base64: string;
  /** Resolves to the local path once the file has been written. */
  ready: Promise<void>;
  resolve: () => void;
}

export class ZumiAudioQueue {
  private readonly chunks = new Map<number, QueuedChunk>();
  private nextPlaySeq = 0;
  private sealed = false;
  private cancelled = false;
  private readonly completionPromise: Promise<void>;
  private resolveCompletion!: () => void;
  private rejectCompletion!: (e: unknown) => void;

  constructor() {
    this.completionPromise = new Promise((res, rej) => {
      this.resolveCompletion = res;
      this.rejectCompletion = rej;
    });
  }

  /**
   * Enqueue a base64 MP3 chunk at position `seq`. Call this as each
   * `audio_chunk` SSE event arrives — chunks may arrive out of order if TTS
   * synthesis for sentence N completes before sentence N-1.
   */
  enqueue(seq: number, base64: string): void {
    if (this.cancelled) return;

    let resolve!: () => void;
    const ready = new Promise<void>(r => { resolve = r; });
    this.chunks.set(seq, { seq, base64, ready, resolve });

    // Signal readiness immediately (file write happens in playChunk).
    resolve();

    // Try to advance the playback cursor.
    void this.advance();
  }

  /** Signal that no more chunks will arrive. */
  seal(): void {
    this.sealed = true;
    void this.advance();
  }

  /** Abort all queued playback immediately. */
  cancel(): void {
    this.cancelled = true;
    this.resolveCompletion();
  }

  /** Resolves when all queued chunks have been played (or the queue is cancelled). */
  waitForCompletion(): Promise<void> {
    return this.completionPromise;
  }

  /** Advance the play cursor: play the next ready in-order chunk. */
  private async advance(): Promise<void> {
    if (this.cancelled) return;

    while (true) {
      const chunk = this.chunks.get(this.nextPlaySeq);
      if (!chunk) {
        // The next chunk hasn't arrived yet.
        if (this.sealed && this.nextPlaySeq > Math.max(...this.chunks.keys(), -1)) {
          // All chunks played.
          this.resolveCompletion();
        }
        return;
      }

      // Wait for the chunk to be ready (it should already be).
      await chunk.ready;
      if (this.cancelled) return;

      const stopChunk = mark(`  audioQueue.playChunk[${chunk.seq}]`);
      try {
        await playBase64(chunk.base64);
        stopChunk('ok');
      } catch {
        stopChunk('ERR');
        // A single bad chunk is skipped — don't break the whole sequence.
      }

      this.chunks.delete(chunk.seq);
      this.nextPlaySeq++;

      if (this.sealed && this.chunks.size === 0 && !this.chunks.has(this.nextPlaySeq)) {
        this.resolveCompletion();
        return;
      }
    }
  }
}
