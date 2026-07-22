"""Kokoro-82M TTS for LiveKit Agents (self-hosted Kokoro-FastAPI).

Bypasses ``livekit.plugins.openai.TTS`` entirely. That plugin routes non-``tts-1``
models through an SSE parser these OpenAI-compatible servers do not speak, and
its MP3 path still yields ``no audio frames were pushed`` under StreamAdapter.
This module POSTs to the ``/v1/audio/speech`` endpoint with
``response_format=pcm`` (24 kHz mono) and pushes raw PCM bytes into LiveKit's
``AudioEmitter`` — the format StreamAdapter expects.

Default target is a local Kokoro-FastAPI container (fast, free):

    docker run -d --name kokoro-tts --restart unless-stopped \
        -p 8880:8880 ghcr.io/remsky/kokoro-fastapi-cpu:latest

OpenRouter's hosted Kokoro (https://openrouter.ai/api/v1/audio/speech, model
``hexgrad/kokoro-82m``) speaks the same request shape but generated audio at
~0.2x real-time when tested (22-30s for a 5s line) — unusable live. Keep it
only as an emergency fallback via KOKORO_BASE_URL + api_key.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

import httpx

from livekit.agents import (
    APIConnectionError,
    APIConnectOptions,
    APIStatusError,
    APITimeoutError,
    tts,
)
from livekit.agents.types import DEFAULT_API_CONNECT_OPTIONS
from livekit.agents.utils import shortuuid

logger = logging.getLogger("zumi-agent.kokoro-tts")

LOCAL_SPEECH_URL = "http://localhost:8880/v1/audio/speech"
SAMPLE_RATE = 24000
NUM_CHANNELS = 1
DEFAULT_MODEL = "kokoro"
DEFAULT_VOICE = "hf_alpha"


@dataclass
class _Opts:
    model: str
    voice: str
    api_key: str
    base_url: str


class KokoroTTS(tts.TTS):
    def __init__(
        self,
        *,
        base_url: str = LOCAL_SPEECH_URL,
        voice: str = DEFAULT_VOICE,
        model: str = DEFAULT_MODEL,
        api_key: str = "",
    ) -> None:
        super().__init__(
            capabilities=tts.TTSCapabilities(streaming=False),
            sample_rate=SAMPLE_RATE,
            num_channels=NUM_CHANNELS,
        )
        self._opts = _Opts(
            model=model,
            voice=voice,
            api_key=api_key,
            base_url=base_url,
        )
        self._client = httpx.AsyncClient(
            timeout=httpx.Timeout(connect=5.0, read=15.0, write=5.0, pool=5.0),
            follow_redirects=True,
            limits=httpx.Limits(
                max_connections=20,
                max_keepalive_connections=10,
                keepalive_expiry=60,
            ),
        )

    @property
    def model(self) -> str:
        return self._opts.model

    @property
    def provider(self) -> str:
        return "kokoro"

    def synthesize(
        self, text: str, *, conn_options: APIConnectOptions = DEFAULT_API_CONNECT_OPTIONS
    ) -> tts.ChunkedStream:
        return _KokoroChunkedStream(tts=self, input_text=text, conn_options=conn_options)

    async def aclose(self) -> None:
        await self._client.aclose()


class _KokoroChunkedStream(tts.ChunkedStream):
    def __init__(
        self, *, tts: KokoroTTS, input_text: str, conn_options: APIConnectOptions
    ) -> None:
        super().__init__(tts=tts, input_text=input_text, conn_options=conn_options)
        self._tts: KokoroTTS = tts

    async def _run(self, output_emitter: tts.AudioEmitter) -> None:
        opts = self._tts._opts
        request_id = shortuuid()
        output_emitter.initialize(
            request_id=request_id,
            sample_rate=SAMPLE_RATE,
            num_channels=NUM_CHANNELS,
            mime_type="audio/pcm",
        )

        headers = {"Content-Type": "application/json"}
        if opts.api_key:
            headers["Authorization"] = f"Bearer {opts.api_key}"
        body = {
            "model": opts.model,
            "input": self.input_text,
            "voice": opts.voice,
            "response_format": "pcm",
        }

        try:
            async with self._tts._client.stream(
                "POST",
                opts.base_url,
                headers=headers,
                json=body,
                timeout=httpx.Timeout(15.0, connect=self._conn_options.timeout),
            ) as resp:
                if resp.status_code >= 400:
                    err_body = (await resp.aread()).decode("utf-8", errors="replace")[:300]
                    raise APIStatusError(
                        f"Kokoro TTS {resp.status_code}: {err_body}",
                        status_code=resp.status_code,
                        request_id=request_id,
                        body=err_body,
                    )

                pushed = 0
                async for chunk in resp.aiter_bytes():
                    if chunk:
                        output_emitter.push(chunk)
                        pushed += len(chunk)

                if pushed == 0:
                    raise APIConnectionError("Kokoro TTS returned an empty audio body")

            output_emitter.flush()
            logger.debug(
                "kokoro ok chars=%d pcm_bytes=%d voice=%s",
                len(self.input_text),
                pushed,
                opts.voice,
            )

        except httpx.TimeoutException as e:
            raise APITimeoutError() from e
        except (APIStatusError, APIConnectionError, APITimeoutError):
            raise
        except Exception as e:
            raise APIConnectionError(f"Kokoro TTS failed: {e}") from e


async def check_server(base_url: str = LOCAL_SPEECH_URL) -> None:
    """Fail fast at worker startup if the Kokoro server isn't reachable."""
    # Kokoro-FastAPI serves GET /health on the same host/port.
    root = base_url.split("/v1/")[0]
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{root}/health")
            resp.raise_for_status()
    except Exception as e:
        raise RuntimeError(
            f"Kokoro TTS server not reachable at {base_url}. "
            "Start it with: docker run -d --name kokoro-tts --restart unless-stopped "
            "-p 8880:8880 ghcr.io/remsky/kokoro-fastapi-cpu:latest"
        ) from e
