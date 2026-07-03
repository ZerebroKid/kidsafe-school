# Zumi Voice Agent

Real-time educational voice assistant powered by LiveKit WebRTC.

## Architecture

```
Child's phone (WebRTC mic) → LiveKit Cloud SFU → This Agent
                                                    ↓
                                          Deepgram STT (nova-3)
                                                    ↓
                                          OpenAI LLM (gpt-4o-mini)
                                                    ↓
                                          Cartesia TTS (sonic-3)
                                                    ↓
Child's phone (WebRTC speaker) ← LiveKit Cloud SFU ←
```

## Setup

```bash
cd apps/zumi-agent
python -m venv .venv
source .venv/bin/activate  # or .venv\Scripts\activate on Windows
pip install -e .
```

Copy `.env.example` to `.env` and fill in the API keys.

Or install via pip:

```bash
pip install -r requirements.txt
```

## Run locally

```bash
python agent.py dev
```

## Deploy to LiveKit Cloud

```bash
lk cloud auth
lk agent deploy
```

## Environment variables

| Variable | Description |
|----------|-------------|
| `LIVEKIT_URL` | LiveKit Cloud WebSocket URL |
| `LIVEKIT_API_KEY` | LiveKit API key |
| `LIVEKIT_API_SECRET` | LiveKit API secret |
| `DEEPGRAM_API_KEY` | Deepgram API key |
| `OPENAI_API_KEY` | OpenAI API key |
| `CARTESIA_API_KEY` | Cartesia API key |
| `CARTESIA_VOICE_ID` | Cartesia voice ID for Zumi |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to Firebase service account JSON (for Firestore access) |
