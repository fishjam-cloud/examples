"""Google Gemini Live translation provider."""

from __future__ import annotations

import base64
import json
import logging
import os
import time
from collections import deque
from dataclasses import dataclass
from typing import Any, ClassVar

from websockets.asyncio.client import ClientConnection, connect
from websockets.exceptions import ConnectionClosed

from .base import (
    PcmChunk,
    PcmFormat,
    ProviderEvent,
    TranscriptEvent,
    TranslationContext,
    TranslationSession,
)


LOGGER = logging.getLogger(__name__)
GOOGLE_INPUT_PCM = PcmFormat(sample_rate=16_000, channels=1)
GOOGLE_OUTPUT_PCM = PcmFormat(sample_rate=24_000, channels=1)
GOOGLE_OUTPUT_GAP_THRESHOLD_US = 500_000
GOOGLE_DEFAULT_MODEL = "models/gemini-3.5-live-translate-preview"
GOOGLE_DEFAULT_API_VERSION = "v1beta"
# Source: Gemini Live Translate supported languages table.
GOOGLE_SUPPORTED_TARGET_LANGUAGES = (
    "af",
    "ak",
    "sq",
    "am",
    "ar",
    "hy",
    "az",
    "eu",
    "be",
    "bn",
    "bg",
    "my",
    "ca",
    "zh-Hans",
    "zh-Hant",
    "hr",
    "cs",
    "da",
    "nl",
    "en",
    "et",
    "fil",
    "fi",
    "fr",
    "gl",
    "ka",
    "de",
    "el",
    "gu",
    "ha",
    "he",
    "hi",
    "hu",
    "is",
    "id",
    "it",
    "ja",
    "jv",
    "kn",
    "kk",
    "km",
    "rw",
    "ko",
    "lo",
    "lv",
    "lt",
    "mk",
    "ms",
    "ml",
    "mr",
    "mn",
    "ne",
    "no",
    "nb",
    "fa",
    "pl",
    "pt-BR",
    "pt-PT",
    "pa",
    "ro",
    "ru",
    "sr",
    "sd",
    "si",
    "sk",
    "sl",
    "es",
    "su",
    "sw",
    "sv",
    "ta",
    "te",
    "th",
    "tr",
    "uk",
    "ur",
    "uz",
    "vi",
    "zu",
)


class GoogleConfigurationError(RuntimeError):
    """Raised when the Google provider is missing required configuration."""


@dataclass(frozen=True)
class GoogleTranslationProvider:
    name: ClassVar[str] = "google"
    supported_target_languages: ClassVar[tuple[str, ...]] = GOOGLE_SUPPORTED_TARGET_LANGUAGES

    model: str = GOOGLE_DEFAULT_MODEL
    api_version: str = GOOGLE_DEFAULT_API_VERSION
    echo_target_language: bool = True
    logger: logging.Logger = LOGGER

    async def start(self, context: TranslationContext) -> TranslationSession:
        api_key = self._api_key()
        websocket = await connect(
            google_live_url(self.api_version),
            additional_headers={"x-goog-api-key": api_key},
            compression=None,
            max_size=None,
        )
        session = GoogleTranslationSession(
            websocket,
            context,
            model=google_model_name(self.model),
            echo_target_language=self.echo_target_language,
            logger=self.logger,
        )
        await session.configure()
        return session

    def _api_key(self) -> str:
        api_key = os.environ.get("GEMINI_API_KEY")
        if api_key:
            return api_key

        api_key = os.environ.get("GOOGLE_API_KEY")
        if api_key:
            self.logger.warning(
                "using GOOGLE_API_KEY; prefer GEMINI_API_KEY for Google credentials"
            )
            return api_key

        raise GoogleConfigurationError("GEMINI_API_KEY is required for provider=google")


class GoogleTranslationSession:
    input_format = GOOGLE_INPUT_PCM
    output_format = GOOGLE_OUTPUT_PCM

    def __init__(
        self,
        websocket: ClientConnection,
        context: TranslationContext,
        *,
        model: str,
        echo_target_language: bool,
        logger: logging.Logger = LOGGER,
    ) -> None:
        self.websocket = websocket
        self.context = context
        self.model = model
        self.echo_target_language = echo_target_language
        self.logger = logger
        self._pending_events: deque[ProviderEvent] = deque()
        self._burst_open = False
        self._output_end_us = 0
        self._first_input_timestamp_us: int | None = None
        self._first_input_sent_us: int | None = None
        self._first_audio_response_logged = False
        self._last_output_arrival_us: int | None = None
        self._last_output_duration_us = 0
        self._closed = False

    async def configure(self) -> None:
        payload = json.dumps(
            {
                "setup": {
                    "model": self.model,
                    "generationConfig": {
                        "responseModalities": ["AUDIO"],
                        "translationConfig": {
                            "targetLanguageCode": self.context.target_language,
                            "echoTargetLanguage": True,
                        },
                    },
                },
            }
        )

        self.logger.info("setup=%s", payload)
        await self.websocket.send(payload)

        while True:
            event = await self._recv_event()
            if "setupComplete" in event:
                self.logger.info(
                    "opened Google translation session source=%s source_track=%s target_language=%s model=%s",
                    self.context.source_path,
                    self.context.source_track,
                    self.context.target_language,
                    self.model,
                )
                return

            self._raise_for_error(event)
            self._log_unhandled_event(event, prefix="Google setup")

    async def send_audio(self, chunk: PcmChunk) -> None:
        if chunk.format != self.input_format:
            raise ValueError(
                f"Google input must be {self.input_format}, got {chunk.format}"
            )

        if self._first_input_sent_us is None:
            self._first_input_timestamp_us = chunk.timestamp_us
            self._first_input_sent_us = time.monotonic_ns() // 1_000
            if self._last_output_arrival_us is None:
                self._output_end_us = chunk.timestamp_us
            self.logger.debug(
                "starting Gemini output clock anchor_ms=%.1f source=%s source_track=%s target_language=%s",
                chunk.timestamp_us / 1_000,
                self.context.source_path,
                self.context.source_track,
                self.context.target_language,
            )

        await self.websocket.send(
            json.dumps(
                {
                    "realtimeInput": {
                        "audio": {
                            "mimeType": f"audio/pcm;rate={self.input_format.sample_rate}",
                            "data": base64.b64encode(chunk.data).decode("ascii"),
                        },
                    },
                }
            )
        )
        self.context.stats.record_model_input_end(_pcm_chunk_end_us(chunk))

    async def receive(self) -> ProviderEvent | None:
        while True:
            if self._pending_events:
                return self._pending_events.popleft()

            event = await self._recv_event()
            if not event and self._closed:
                return None

            self._raise_for_error(event)
            self._queue_provider_events(event)

            if self._pending_events:
                return self._pending_events.popleft()

            self._log_unhandled_event(event)

    async def close(self) -> None:
        if self._closed:
            return
        self._closed = True
        await self.websocket.close()

    async def _recv_event(self) -> dict[str, Any]:
        try:
            raw = await self.websocket.recv()
        except ConnectionClosed as exc:
            if self._closed:
                return {}
            raise RuntimeError("Google realtime connection closed") from exc

        if isinstance(raw, bytes):
            raw = raw.decode("utf-8")
        event = json.loads(raw)
        if self.logger.isEnabledFor(logging.DEBUG):
            self.logger.debug(
                "Google response payload=%s",
                json.dumps(_redact_audio_payload(event), sort_keys=True),
            )
        return event

    def _queue_provider_events(self, event: dict[str, Any]) -> None:
        server_content = event.get("serverContent") or event.get("server_content")
        if not isinstance(server_content, dict):
            return

        arrival_us = time.monotonic_ns() // 1_000
        audio_parts = _audio_parts(server_content)
        if audio_parts:
            self._log_first_audio_response_latency(arrival_us)

        input_transcript = _transcription_text(
            server_content, "inputTranscription", "input_transcription"
        )
        output_transcript = _transcription_text(
            server_content, "outputTranscription", "output_transcription"
        )

        for data in audio_parts:
            timestamp_us = self._next_output_timestamp(data, arrival_us)
            self._pending_events.append(
                ProviderEvent(
                    audio=PcmChunk(
                        data=data, format=self.output_format, timestamp_us=timestamp_us
                    )
                )
            )

        if input_transcript:
            self._pending_events.append(
                ProviderEvent(
                    transcript=TranscriptEvent(kind="input", delta=input_transcript)
                )
            )

        if output_transcript:
            self._pending_events.append(
                ProviderEvent(
                    transcript=TranscriptEvent(kind="output", delta=output_transcript)
                )
            )

        if server_content.get("generationComplete") or server_content.get(
            "turnComplete"
        ):
            if self._burst_open:
                self.logger.debug("closing Google output burst")
            self._burst_open = False

        if server_content.get("interrupted"):
            self.logger.info(
                "Google realtime generation interrupted source=%s source_track=%s",
                self.context.source_path,
                self.context.source_track,
            )

    def _raise_for_error(self, event: dict[str, Any]) -> None:
        if not event:
            return
        if "error" in event:
            raise RuntimeError(f"Google realtime error: {event['error']}")

    def _log_unhandled_event(
        self, event: dict[str, Any], *, prefix: str = "Google realtime"
    ) -> None:
        if not event:
            return

        message_type = _message_type(event)
        self.logger.debug("%s event type=%s", prefix, message_type)

    def _log_first_audio_response_latency(self, arrival_us: int) -> None:
        if (
            self._first_audio_response_logged
            or self._first_input_sent_us is None
        ):
            return

        self._first_audio_response_logged = True
        latency_us = max(0, arrival_us - self._first_input_sent_us)
        self.context.stats.record_first_response_latency(latency_us)
        input_timestamp_us = (
            self._first_input_timestamp_us
            if self._first_input_timestamp_us is not None
            else 0
        )
        self.logger.info(
            (
                "Gemini first audio response latency_ms=%.1f "
                "first_input_timestamp_ms=%.1f source=%s source_track=%s target_language=%s"
            ),
            latency_us / 1_000,
            input_timestamp_us / 1_000,
            self.context.source_path,
            self.context.source_track,
            self.context.target_language,
        )

    def _next_output_timestamp(self, data: bytes, arrival_us: int) -> int:
        duration_us = (
            self.output_format.samples_for(data)
            * 1_000_000
            // self.output_format.sample_rate
        )
        previous_end_us = (
            self._output_end_us if self._last_output_arrival_us is not None else None
        )
        timestamp_us = self._output_end_us
        elapsed_us: int | None = None
        idle_us: int | None = None
        preserved_gap_us: int | None = None

        if self._last_output_arrival_us is None:
            self.logger.debug(
                "starting Google output audio timestamp anchor_ms=%.1f",
                timestamp_us / 1_000,
            )
        else:
            elapsed_us = max(0, arrival_us - self._last_output_arrival_us)
            idle_us = elapsed_us - self._last_output_duration_us
            if idle_us > GOOGLE_OUTPUT_GAP_THRESHOLD_US:
                timestamp_us += idle_us
                preserved_gap_us = idle_us

        output_gap_us = (
            timestamp_us - previous_end_us if previous_end_us is not None else None
        )
        output_end_us = timestamp_us + duration_us
        self.logger.debug(
            (
                "Google output audio delta bytes=%d duration_ms=%.1f arrival_delta_ms=%s "
                "idle_gap_ms=%s output_gap_ms=%s preserved_gap_ms=%s timestamp_ms=%.1f end_ms=%.1f"
            ),
            len(data),
            duration_us / 1_000,
            _format_ms(elapsed_us),
            _format_ms(idle_us),
            _format_ms(output_gap_us),
            _format_ms(preserved_gap_us),
            timestamp_us / 1_000,
            output_end_us / 1_000,
        )
        self._burst_open = True
        self._last_output_arrival_us = arrival_us
        self._last_output_duration_us = duration_us
        self._output_end_us = output_end_us
        self.context.stats.record_model_output_end(output_end_us)
        return timestamp_us


def google_live_url(api_version: str) -> str:
    version = api_version.strip()
    if not version:
        raise ValueError("Google API version cannot be empty")

    return (
        "wss://generativelanguage.googleapis.com/ws/"
        f"google.ai.generativelanguage.{version}.GenerativeService.BidiGenerateContent"
    )


def google_model_name(model: str) -> str:
    model = model.strip()
    if not model:
        raise ValueError("Google model cannot be empty")
    if model.startswith("models/"):
        return model
    return f"models/{model}"


def _audio_parts(server_content: dict[str, Any]) -> list[bytes]:
    model_turn = server_content.get("modelTurn") or server_content.get("model_turn")
    if not isinstance(model_turn, dict):
        return []

    audio: list[bytes] = []
    for part in model_turn.get("parts", []):
        if not isinstance(part, dict):
            continue

        inline_data = part.get("inlineData") or part.get("inline_data")
        if not isinstance(inline_data, dict):
            continue

        mime_type = inline_data.get("mimeType") or inline_data.get("mime_type") or ""
        if mime_type and not str(mime_type).startswith("audio/"):
            continue

        data = inline_data.get("data")
        if data:
            audio.append(base64.b64decode(data))

    return audio


def _transcription_text(server_content: dict[str, Any], *keys: str) -> str:
    for key in keys:
        transcription = server_content.get(key)
        if isinstance(transcription, dict):
            text = transcription.get("text")
            if text:
                return str(text)
    return ""


def _pcm_chunk_end_us(chunk: PcmChunk) -> int:
    duration_us = chunk.samples * 1_000_000 // chunk.format.sample_rate
    return chunk.timestamp_us + duration_us


def _message_type(event: dict[str, Any]) -> str:
    for key in (
        "setupComplete",
        "serverContent",
        "toolCall",
        "toolCallCancellation",
        "goAway",
        "sessionResumptionUpdate",
        "error",
    ):
        if key in event:
            return key
    return ",".join(sorted(event)) or "empty"


def _redact_audio_payload(value: Any) -> Any:
    if isinstance(value, dict):
        redacted = {key: _redact_audio_payload(child) for key, child in value.items()}
        mime_type = redacted.get("mimeType") or redacted.get("mime_type") or ""
        if _is_audio_mime_type(mime_type) and isinstance(redacted.get("data"), str):
            redacted["data"] = f"<omitted base64 audio chars={len(redacted['data'])}>"
        return redacted

    if isinstance(value, list):
        return [_redact_audio_payload(item) for item in value]

    return value


def _is_audio_mime_type(mime_type: Any) -> bool:
    return str(mime_type).startswith("audio/")


def _format_ms(value_us: int | None) -> str:
    if value_us is None:
        return "n/a"
    return f"{value_us / 1_000:.1f}"
