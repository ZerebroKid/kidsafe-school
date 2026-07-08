/**
 * Bundled topic-explanation videos for Zumi.
 *
 * When the adaptive teaching loop reaches the `explain` phase, the session
 * manager checks this map: if the current topic has a video, Zumi pauses and
 * the video (with its own voiceover) plays fullscreen before she continues.
 *
 * Videos are bundled in the APK (see `assets/video/`) so playback starts
 * instantly with no network dependency — right for a demo build. If the
 * library grows, move them to Firebase Storage + a small manifest.
 */

/** RN bundled asset ids are numbers (Metro `require` of an mp4). */
export type ZumiVideoSource = number;

const CH5_MATTER: ZumiVideoSource = require('../../assets/video/zumi_ch5_matter.mp4');

/**
 * Find the explanation video for a topic, matching loosely on the topic name
 * so both "Matter" and the `matter` slug resolve.
 * Returns `null` when the topic has no video (the session just continues).
 */
export function findTopicVideo(topicName: string): ZumiVideoSource | null {
  const n = (topicName ?? '').toLowerCase();
  if (n.includes('matter')) {
    return CH5_MATTER;
  }
  return null;
}
