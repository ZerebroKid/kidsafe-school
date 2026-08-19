# Zumi Live Voice Agent

The streaming voice backend for Zumi. One persistent WebRTC connection per
lesson replaces the old callable round trips (`zumiTeach` + `zumiSpeak` +
`zumiTranscribe`), cutting turn latency from ~8-12s to under ~1.5s:

- **Transport**: LiveKit Cloud (WebRTC — echo cancellation, jitter handling)
- **Turn-taking**: local Silero VAD + LiveKit semantic turn detector, 400ms endpointing, barge-in on
- **STT**: Sarvam Saaras v3 (English hint, `en-IN`) or self-hosted Whisper `medium.en` -- English-only pass, Indian-accent robust
- **Safety**: moderation on the child's transcript AND Zumi's reply before TTS (`safety.py`), remote-killable
- **LLM**: OpenAI gpt-4o-mini, streamed tokens
- **TTS**: Kokoro-82M, self-hosted Kokoro-FastAPI (raw PCM, custom plugin in `kokoro_tts.py`)

The app requests a room token from the `zumiLiveKitToken` Firebase callable
(which authorizes the child against the assignment), joins the room, and this
worker is dispatched to teach the session. Quiz verdicts are written straight
to Firestore `quizVoiceEvals` in the schema `submitQuizAttempt` reads, so the
final score stays server-authoritative.

## Setup (once)

```bash
cd apps/zumi-agent
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env   # fill in the keys

# Kokoro TTS server (local, free, faster than real-time)
sudo docker run -d --name kokoro-tts --restart unless-stopped \
  -p 8880:8880 ghcr.io/remsky/kokoro-fastapi-cpu:latest
```

`.env` needs: `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` (from
cloud.livekit.io project settings), `SARVAM_API_KEY` (dashboard.sarvam.ai),
`OPENAI_API_KEY`, `KOKORO_BASE_URL` (default local :8880), `KOKORO_VOICE`
(optional, default `af_heart` -- English voice; `hf_alpha` is the Hindi
voice for the future Hinglish phase).

Firestore access uses Application Default Credentials
(`gcloud auth application-default login`, already configured on this machine).

## Run (demo)

```bash
.venv/bin/python agent.py dev
```

Leave it running; it connects out to LiveKit Cloud (no ports to open) and is
auto-dispatched whenever a child starts a Zumi session in the app.

## Turn-taking and latency

The session logs its turn-taking config once per session and one `[perf]` line
per turn — the number that matters is the last one, the child's end of speech to
Zumi's first audio (target 1.5s):

```
[config] vad_silence=0.25s endpointing=0.40-2.50s turn_detection=inference interruptions=on(min 0.60s/0 words) target=1.5s
[perf] turn speech_ab12: eou 420ms (transcript 200ms) + llm ttft 380ms + tts ttfb 510ms = 1310ms to first audio
[perf] session latency: turns=7 p50=1290ms p95=1880ms max=1950ms over-1.5s=2 scripted_tts_p50=410ms
```

Turns over the target are flagged inline, and the session-close summary is the
baseline to compare against when STT/TTS get swapped later. Scripted lines
(`session.say()`, intro steps) have no child utterance to measure from, so they
are reported separately as `scripted_tts_p50`.

Every knob is env-overridable (see `.env.example`) — no code change needed to
retune. The two that matter most:

- `ZUMI_ENDPOINT_MIN_DELAY` (default `0.4`) — silence before Zumi answers.
  Below 0.3 she interrupts children mid-thought; above 0.5 she feels slow.
- `ZUMI_TURN_DETECTOR` (default `inference`) — LiveKit's hosted semantic
  end-of-turn model. Set to `vad` for pure-silence endpointing with no external
  dependency (also the automatic fallback if the hosted model can't load).

Barge-in is on for the quiz (the child can talk over Zumi and she stops). The
scripted intro deliberately keeps the mic muted with `allow_interruptions=False`
per line, so room noise can't derail the lesson script; `ZUMI_INTERRUPTIONS=off`
disables interruptions everywhere.

## Safety layer

Two moderation checkpoints wrap the LLM (`SafeAgent.llm_node` + `safety.py`),
both using OpenAI's free `omni-moderation-latest`:

- **Input**: the child's final transcript, checked IN PARALLEL with the LLM
  writing its reply (the ~0.5-1.5s moderation latency hides behind generation).
- **Output**: Zumi's reply, checked before it reaches TTS or the speech bubble.
  This is the one serial cost per turn — watch the `[safety] out ok (...)` ms
  next to the `[perf]` lines.

Flagged content is replaced with a pre-written redirect (never improvised):
generic deflection for inappropriate content, a special caring line for
self-harm/distress categories, and the quiz re-asks the current question so a
blocked answer is never graded and never stalls the flow. Moderation failures
FAIL OPEN (logged `[safety] ... FAILED OPEN`) so an OpenAI hiccup can't freeze
a lesson. Prompt-level guardrails (`safety.SAFETY_RULES`) cover what moderation
can't, e.g. "ignore your rules" persona attacks and personal-info probing.

**Kill switch**: `appConfig/zumi.moderationEnabled` in Firestore (read once per
session). `false` (default) = checkpoints fully inert, zero added latency.
Flip to `true` from the Firebase console to enforce — no deploy needed.
Tuning: `ZUMI_MODERATION_TIMEOUT` (default 2.5s), `ZUMI_MODERATION_STRICT_SCORE`
(default 0.4 — any category at/above this flags, stricter than OpenAI's own bit).

## STT providers (Phase 5)

The STT stage is chosen per session by `appConfig/zumi.sttProvider`:

- `sarvam` (default) — today's managed streaming STT, unchanged.
- `whisper` — self-hosted faster-whisper on the GPU VM (`ZUMI_WHISPER_URL`,
  see [infra/](infra/)), spoken to through its OpenAI-compatible API. It is
  per-utterance rather than streaming, so the session VAD segments speech
  for it, and it is always wrapped in a `FallbackAdapter` with Sarvam behind
  it: a stopped or unreachable GPU VM degrades to exactly today's pipeline
  mid-session instead of killing the conversation. Default model is
  `medium.en` (English-only, handles Indian-accented English well); the
  multilingual `medium` + `ZUMI_WHISPER_LANGUAGE=hi` is the documented
  switch for the future Hinglish phase.

Look for `[config] stt=whisper url=... model=... (sarvam fallback)` at
session start, and compare `[perf]` lines between providers — that's the
side-by-side latency/accuracy check this phase is reviewed on.
**Rollback**: set `sttProvider: "sarvam"` in the Firebase console (no deploy).

## TTS providers (Phase 6)

The TTS stage is chosen per session by `appConfig/zumi.ttsProvider`:

- `kokoro-cpu` (default) — today's local Kokoro-FastAPI container, unchanged.
- `kokoro-gpu` — the SAME Kokoro-FastAPI server, GPU build, on the Phase 4
  VM (`ZUMI_KOKORO_GPU_URL`, port 8880, see [infra/](infra/)). Benchmarked
  at ~0.5s per sentence vs ~2.6s on CPU. Always wrapped in a
  `FallbackAdapter` with the CPU endpoint behind it, so a stopped VM
  degrades to today's pipeline mid-session.

Synthesis is sentence-streaming either way: the session's `StreamAdapter`
splits the LLM token stream into sentences and synthesizes each as soon as
it's complete, so Zumi's first audio starts after the FIRST sentence — the
GPU cuts the per-sentence wait, which is the time-to-first-audio win.

Look for `[config] tts=kokoro-gpu url=... (cpu fallback ...)` at session
start and per-request `kokoro ttfb=...s total=...s` lines to compare
providers against the `[perf]`/`[latency]` target (first audio < 1.5s).
**Rollback**: set `ttsProvider: "kokoro-cpu"` in the Firebase console (no deploy).

## Remote config (`appConfig/zumi`)

All the flags above live in ONE Firestore doc, seeded/updated with:

```bash
pnpm seed:zumi-config -- --apply --target=prod                      # safe defaults
pnpm seed:zumi-config -- --apply --target=prod --stt=whisper --tts=kokoro-gpu
```

(or edit the doc in the Firebase console — same effect, no deploy). Until the
doc exists, every reader falls back to code defaults, which notably means
`moderationEnabled=false`. The seed defaults are: `pipeline=live`,
`sttProvider=sarvam`, `ttsProvider=kokoro-cpu`, `moderationEnabled=true`,
`memoryEnabled=true`, `dailyMinutesLimit=20`.

## Memory, session summary, and daily quota

At session end (quiz done, child left, or worker draining) the agent makes ONE
batched Firestore write — never per turn:

- `zumiSessions/{assignmentId}_{childUid}_{startedAtMs}` — audit doc: duration,
  turn count, last 12 turns, latency p50/p95, safety-event count, quiz score.
- `zumiMemory/{childUid}` — fixed per-child doc with the last turns, read back
  at the start of the NEXT session so Zumi can greet like a friend who
  remembers ("How are Rahul and Priya?"). Loaded in parallel with the
  config read, capped at 2s — a slow read never delays Zumi's first word.
  Kill switch: `appConfig/zumi.memoryEnabled: false` (default on).
- `children/{childUid}/zumiUsage/{YYYY-MM-DD}` — `minutes` + `sessions`
  increments (school day = Asia/Kolkata, same as the education stack).

The quota is enforced at the DOOR, not mid-session: `zumiLiveKitToken` refuses
to mint a token (`resource-exhausted`, kid-friendly message) once
today's `minutes` reach `appConfig/zumi.dailyMinutesLimit`. Unset or `<= 0`
means unlimited — the meter ships inert until the console sets a limit. All
three collections are client-read-only (child + their parent); only the agent
writes them.

Look for `[flow] memory loaded: ...` at start and
`[flow] session summary persisted: ...` at end.

Console mode (talk to Zumi from this terminal, no app needed — note the
teaching context comes from participant metadata, so console mode will fail
at story load unless you stub it):

```bash
.venv/bin/python agent.py console
```

## GPU inference services (Phase 4)

A separate spot GPU VM (`zumi-gpu-1`, GCP project `zumi-gpu`, asia-south1,
T4) hosts GPU Kokoro TTS and faster-whisper STT for Phases 5–6. Compose
file, full recreate/start/stop runbook, and benchmark numbers live in
[infra/](infra/). Nothing uses it until the `sttProvider`/`ttsProvider`
flags flip — rollback is "stop the VM".

## Deploying later

This is a plain worker process — to run it without the laptop, put the same
files + `.env` on any small VM (or LiveKit Cloud's agent hosting) and run
`python agent.py start`.
