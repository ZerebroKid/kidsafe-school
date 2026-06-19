/**
 * ZumiCue -- renders the "in between" story animations the session manager asks
 * for. The manager emits a cue (a normalised `VoiceAnimation`: a Lottie stage
 * cue or a Rive state name); we map it to one of the bundled Lottie clips, or a
 * remote Storage URL when one is provided as an override.
 *
 * Rive note: authoring a real `.riv` is an art deliverable, so the Rive-intended
 * moments (`concept_zoom`, `sort_game`) are expressed here with bundled Lottie
 * stand-ins. When a branded `.riv` ships, this resolver is the single place to
 * branch to a real Rive renderer.
 *
 * Two pieces:
 *   - `ZumiSceneCue`   -> the current stage animation, drawn BEHIND the mascot.
 *   - `ZumiCelebration`-> a confetti burst drawn IN FRONT while celebrating.
 */

import React from 'react';
import {StyleSheet} from 'react-native';

import {AnimationPlayer} from './AnimationPlayer';
import {RivePlayer} from './RivePlayer';

const CHAOS = require('../../../assets/lottie/chaos.json');
const BOOKS = require('../../../assets/lottie/books.json');
const FLASHCARD = require('../../../assets/lottie/flashcard.json');
const SPARKLE = require('../../../assets/lottie/sparkle.json');
const CONFETTI = require('../../../assets/lottie/confetti.json');

/** Bundled clip ids the adaptive teaching loop can request directly. */
export type ZumiClip = 'chaos' | 'books' | 'sparkle' | 'flashcard' | 'confetti';
const CLIPS: Record<ZumiClip, object> = {
  chaos: CHAOS,
  books: BOOKS,
  sparkle: SPARKLE,
  flashcard: FLASHCARD,
  confetti: CONFETTI,
};

/**
 * Rive `.riv` files bundled into the NATIVE app (android `res/raw`, iOS bundle),
 * keyed by the author's Rive intent. EMPTY until art ships -- see
 * `assets/ZUMI_ASSET_SPEC.md`. The moment a designer drops e.g.
 * `zumi_sort_game.riv` into res/raw and adds the entry below, that cue upgrades
 * from the Lottie stand-in to the real interactive Rive automatically.
 */
const BUNDLED_RIVE: Record<string, string> = {
  // sort_game: 'zumi_sort_game',
  // concept_zoom: 'zumi_concept_zoom',
  // experiment: 'zumi_experiment',
};

/** State-machine name every Zumi `.riv` is authored to expose (see spec). */
const ZUMI_RIVE_STATE_MACHINE = 'zumi';

/** Resolve a bundled Rive resource for a cue, or null to fall back to Lottie. */
function riveResourceFor(cue: ZumiCueData): string | null {
  const key = (cue.stateName || cue.key || '').toLowerCase();
  for (const intent of Object.keys(BUNDLED_RIVE)) {
    if (key.includes(intent)) return BUNDLED_RIVE[intent];
  }
  return null;
}

export interface ZumiCueData {
  kind: 'lottie' | 'rive';
  /** Author key, e.g. `stage_3_lottie`, `rive_interaction_1`. */
  key: string;
  /** Stage 1-10 parsed from the key (0 when not stage-scoped). */
  stageNumber: number;
  /** Rive state name (Rive cues only), e.g. `concept_zoom`, `sort_game`. */
  stateName?: string | null;
  /** Optional remote Lottie URL override (Storage); preferred when present. */
  remoteUrl?: string | null;
  /** Explicit bundled-clip id (preferred); set by the adaptive teaching loop. */
  clip?: ZumiClip | null;
}

/** Pick the bundled Lottie clip that best fits a cue. */
function localSourceFor(cue: ZumiCueData): object {
  if (cue.kind === 'rive') {
    if (cue.stateName === 'sort_game') return CHAOS;
    // concept_zoom + anything else -> a celebratory sparkle reveal.
    return SPARKLE;
  }
  switch (cue.stageNumber) {
    case 3:
      return CHAOS; // 10-item memory test: items flying around
    case 5:
      return BOOKS; // library books self-sorting onto shelves
    case 8:
      return FLASHCARD; // exam mode: flashcard flip
    default:
      return SPARKLE;
  }
}

export function ZumiSceneCue({cue}: {cue: ZumiCueData | null}) {
  if (!cue) return null;
  // Preferred path: an explicit bundled clip chosen by the teaching director.
  if (cue.clip && CLIPS[cue.clip]) {
    return <AnimationPlayer source={CLIPS[cue.clip]} style={styles.layer} />;
  }
  if (cue.kind === 'rive') {
    const resource = riveResourceFor(cue);
    if (resource) {
      return (
        <RivePlayer
          resourceName={resource}
          stateMachineName={ZUMI_RIVE_STATE_MACHINE}
          style={styles.layer}
        />
      );
    }
    // No bundled .riv for this cue yet -> Lottie stand-in.
    return <AnimationPlayer source={localSourceFor(cue)} style={styles.layer} />;
  }
  if (cue.remoteUrl) {
    return <AnimationPlayer url={cue.remoteUrl} style={styles.layer} />;
  }
  return <AnimationPlayer source={localSourceFor(cue)} style={styles.layer} />;
}

export function ZumiCelebration({show}: {show: boolean}) {
  if (!show) return null;
  return <AnimationPlayer source={CONFETTI} loop={false} style={styles.layer} />;
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
  },
});
