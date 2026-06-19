# Zumi Fun-Mode Asset Spec

This is the single source of truth for every art asset Zumi (grade <= 6 "Fun"
mode) uses, where each file lives, and the exact code line that activates it.
Hand this file to the designer; a developer can drop assets in by following the
"Where it goes" + "How to activate" notes. Nothing here blocks the app: every
slot has a working placeholder today, so real art is a drop-in upgrade.

Asset types:

- PNG  -> Zumi's character frames (RN `Image`)
- Lottie (`.json`) -> the "in between" scene animations (looping vector clips)
- Rive (`.riv`) -> the interactive, touch-driven story moments (state machines)

---

## 1. Zumi character frames (PNG)

The mascot the child sees the whole session. Driven by motion in
[`components/ZumiCharacter.tsx`](components/ZumiCharacter.tsx) (bob, tilt, pulse,
lip-sync), so only THREE frames are needed; every other mood is expressed with
motion.

| Slot       | File                          | Used for                          |
| ---------- | ----------------------------- | --------------------------------- |
| Idle       | `assets/zumi/zumi_idle.png`   | breathing, listening, thinking    |
| Talking    | `assets/zumi/zumi_talk.png`   | mouth-open frame during lip-sync  |
| Celebrate  | `assets/zumi/zumi_celebrate.png` | correct answers / wins         |

Requirements:

- Transparent PNG, square canvas, ~1024x1024, character centered.
- `zumi_talk.png` = same pose as idle but mouth OPEN (cheap 2-frame lip-sync).
- Consistent character size/position across all three so frames don't "jump".
- Signature colour is purple `#8b5cf6` (matches the screen accent).

Where it goes: `apps/kids/src/assets/zumi/` (overwrite the existing placeholders).
How to activate: automatic — same filenames, no code change.

---

## 2. Scene Lottie clips (`.json`)

These play BEHIND Zumi during specific stages (see
[`components/ZumiCue.tsx`](components/ZumiCue.tsx) -> `localSourceFor`). The cue
is chosen by the story stage number.

| Stage | Slot file                         | What the child should see (search query)        |
| ----- | --------------------------------- | ----------------------------------------------- |
| 3     | `assets/lottie/chaos.json`        | messy items flying around (memory-test chaos)   |
| 5     | `assets/lottie/books.json`        | books self-sorting onto shelves                 |
| 8     | `assets/lottie/flashcard.json`    | exam-mode flashcard flip                        |
| any   | `assets/lottie/sparkle.json`      | generic sparkle/reveal (default fallback)       |
| win   | `assets/lottie/confetti.json`     | confetti burst on celebration (one-shot)        |

Requirements:

- Lottie JSON exported from After Effects (Bodymovin) or lottiefiles.com.
- Loops cleanly (except `confetti.json`, which is one-shot).
- Transparent background; tuned to read well centered behind the character.

Where it goes: `apps/kids/src/assets/lottie/` (overwrite the placeholders).
How to activate: automatic — same filenames, no code change.

Per-topic remote override (optional): each topic's `voiceStory.animations[]`
entry can carry a `lottieStorageUrl` (a Firebase Storage URL) and a
`searchQuery` hint. When `lottieStorageUrl` is set, the cue streams that clip
INSTEAD of the bundled one (see `ZumiSceneCue` -> `cue.remoteUrl`). Use this to
ship topic-specific Lottie without rebuilding the app.

---

## 3. Interactive Rive files (`.riv`)

Rive powers the touch-driven "game" moments. Unlike Lottie, Rive loads from the
NATIVE bundle by resource name (no `require`). Until a `.riv` is bundled, these
cues fall back to the Lottie stand-in automatically — so shipping Rive is a pure
upgrade.

| Rive intent  | Bundle name (no extension) | Fires when (`VoiceAnimation.stateName`) |
| ------------ | -------------------------- | --------------------------------------- |
| Sort game    | `zumi_sort_game`           | `sort_game`                             |
| Concept zoom | `zumi_concept_zoom`        | `concept_zoom`                          |
| Experiment   | `zumi_experiment`          | `experiment`                            |

Authoring requirements (give these to the Rive designer):

- One **state machine named exactly `zumi`** per file (the app runs that SM —
  see `ZUMI_RIVE_STATE_MACHINE` in `ZumiCue.tsx`).
- Expose the SM inputs the moment needs, e.g. for `zumi_sort_game`: pointer
  drag of items into bins, a boolean `correct` trigger, a `reset` trigger.
- Artboard sized to a square-ish canvas; transparent background; on-brand purple.
- Keep file size lean (< ~300 KB) so startup stays fast.

Where the `.riv` files go (BOTH platforms):

- Android: `apps/kids/android/app/src/main/res/raw/zumi_sort_game.riv`
  (create the `res/raw/` folder if missing; lowercase names, no spaces/dashes —
  use underscores).
- iOS: add the `.riv` to the app target's "Copy Bundle Resources" in Xcode
  (ZKid is Android-first today, but keep parity for later).

How to activate (one-line change): in
[`components/ZumiCue.tsx`](components/ZumiCue.tsx) uncomment the matching entry
in the `BUNDLED_RIVE` map:

```ts
const BUNDLED_RIVE: Record<string, string> = {
  sort_game: 'zumi_sort_game',
  concept_zoom: 'zumi_concept_zoom',
  experiment: 'zumi_experiment',
};
```

That's it — the cue then renders the real interactive Rive via
[`components/RivePlayer.tsx`](components/RivePlayer.tsx); remove an entry to fall
back to Lottie. A rebuild is required (native resource).

---

## 4. Live touch interactivity (no art required)

The game-feel layer lives in
[`components/ZumiPlayground.tsx`](components/ZumiPlayground.tsx) and needs no
assets — it uses gesture-handler + reanimated:

- Tap anywhere on the stage -> emoji sparkle burst + Zumi bounce.
- Floating "toys" the child can grab and fling (they spring back home).

To upgrade the look: swap the emoji in `SPARKLES` / `TOYS` for small PNGs (use
the same `assets/zumi/` folder) and render `<Image>` instead of `<Text>`. To add
a stage-specific mini-game, prefer a Rive file (section 3) so the interaction
logic lives in the state machine.

Build note: `ZumiPlayground` requires the reanimated babel plugin (already added
to `apps/kids/babel.config.js`). After pulling these changes, restart Metro with
`--reset-cache` and rebuild the app.
