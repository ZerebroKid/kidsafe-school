# Zumi Live Voice Agent

The streaming voice backend for Zumi. One persistent WebRTC connection per
lesson replaces the old callable round trips (`zumiTeach` + `zumiSpeak` +
`zumiTranscribe`), cutting turn latency from ~8-12s to under ~1.5s:

- **Transport**: LiveKit Cloud (WebRTC — echo cancellation, jitter handling)
- **Turn-taking**: local Silero VAD + LiveKit semantic turn detector, 400ms endpointing, barge-in on
- **STT**: Sarvam Saaras v3, streaming, Hinglish/code-mix native
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
(optional, default `hf_alpha`).

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

Console mode (talk to Zumi from this terminal, no app needed — note the
teaching context comes from participant metadata, so console mode will fail
at story load unless you stub it):

```bash
.venv/bin/python agent.py console
```

## Deploying later

This is a plain worker process — to run it without the laptop, put the same
files + `.env` on any small VM (or LiveKit Cloud's agent hosting) and run
`python agent.py start`.
