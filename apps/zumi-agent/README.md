# Zumi Live Voice Agent

The streaming voice backend for Zumi. One persistent WebRTC connection per
lesson replaces the old callable round trips (`zumiTeach` + `zumiSpeak` +
`zumiTranscribe`), cutting turn latency from ~8-12s to under ~1.5s:

- **Transport**: LiveKit Cloud (WebRTC — echo cancellation, VAD, jitter handling)
- **STT**: Sarvam Saaras v3, streaming, Hinglish/code-mix native
- **LLM**: OpenAI gpt-4o-mini, streamed tokens
- **TTS**: ElevenLabs Flash v2.5, streamed audio

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
```

`.env` needs: `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` (from
cloud.livekit.io project settings), `SARVAM_API_KEY` (dashboard.sarvam.ai),
`OPENAI_API_KEY`, `ELEVEN_API_KEY` (same keys the Firebase functions use).

Firestore access uses Application Default Credentials
(`gcloud auth application-default login`, already configured on this machine).

## Run (demo)

```bash
.venv/bin/python agent.py dev
```

Leave it running; it connects out to LiveKit Cloud (no ports to open) and is
auto-dispatched whenever a child starts a Zumi session in the app. Watch the
`[perf]` log lines for per-stage latency (end-of-utterance -> LLM first token
-> TTS first audio).

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
