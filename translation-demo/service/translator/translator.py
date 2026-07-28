"""Provider-neutral track translation orchestration."""

from __future__ import annotations

import asyncio
import contextlib
import logging
from typing import Protocol

from .catalog import AudioPublication
from .media import AudioTranslationPipeline
from .moq_compat import moq
from .providers import TranslationContext, TranslationProvider
from .stats import SESSION_STATS_LOG_INTERVAL_SECONDS
from .transcript import TranscriptPublisher


LOGGER = logging.getLogger(__name__)


class MediaOutput(Protocol):
    def write_frame(self, payload: bytes, timestamp_us: int) -> None: ...


class TrackTranslator:
    """Runs one active source track through decode, provider, and encode."""

    def __init__(
        self,
        provider: TranslationProvider,
        *,
        logger: logging.Logger = LOGGER,
    ) -> None:
        self.provider = provider
        self.logger = logger

    async def run(
        self,
        *,
        source_consumer: moq.MediaConsumer,
        output_media: MediaOutput,
        source: AudioPublication,
        context: TranslationContext,
        transcript: TranscriptPublisher | None = None,
    ) -> None:
        session = await self.provider.start(context)
        send_task: asyncio.Task[None] | None = None
        receive_task: asyncio.Task[None] | None = None
        stats_task: asyncio.Task[None] | None = None

        try:
            pipeline = AudioTranslationPipeline(
                source.audio,
                provider_input=session.input_format,
                provider_output=session.output_format,
                stats=context.stats,
            )
            provider_name = _provider_label(
                getattr(self.provider, "name", self.provider.__class__.__name__)
            )
            stats_task = asyncio.create_task(
                self._log_session_stats(context, provider_name),
                name=f"translation-stats:{context.source_path}:{context.source_track}",
            )

            send_task = asyncio.create_task(
                self._send_source_audio(source_consumer, session, pipeline),
                name=f"provider-send:{context.source_path}:{context.source_track}",
            )
            receive_task = asyncio.create_task(
                self._receive_translated_audio(output_media, session, pipeline, transcript),
                name=f"provider-receive:{context.source_path}:{context.source_track}",
            )

            done, pending = await asyncio.wait(
                {send_task, receive_task},
                return_when=asyncio.FIRST_COMPLETED,
            )

            for task in done:
                if task.cancelled():
                    raise asyncio.CancelledError
                exc = task.exception()
                if exc is not None:
                    raise exc

            await session.close()
            for task in pending:
                task.cancel()
            await asyncio.gather(*pending, return_exceptions=True)

            for encoded in pipeline.finish():
                output_media.write_frame(encoded.payload, encoded.timestamp_us)
        finally:
            await self._close_session(session)
            if send_task is not None:
                await self._cancel_task(send_task)
            if receive_task is not None:
                await self._cancel_task(receive_task)
            if stats_task is not None:
                await self._cancel_task(stats_task)

    async def _send_source_audio(self, source_consumer, session, pipeline: AudioTranslationPipeline) -> None:
        async for frame in source_consumer:
            for chunk in pipeline.decode_source(frame):
                await session.send_audio(chunk)

    async def _receive_translated_audio(
        self,
        output_media: MediaOutput,
        session,
        pipeline: AudioTranslationPipeline,
        transcript: TranscriptPublisher | None,
    ) -> None:
        clock_us = 0
        while True:
            event = await session.receive()
            if event is None:
                return

            # One provider event may carry both audio and transcript text.
            # Encode the audio first so a transcript delta from the same event
            # is stamped with its own burst's output position; a text-only
            # event uses the running clock (the upcoming burst starts there,
            # since the output timeline is continuous).
            burst_start_us: int | None = None
            if event.audio is not None:
                for encoded in pipeline.encode_translation(event.audio):
                    output_media.write_frame(encoded.payload, encoded.timestamp_us)
                    if burst_start_us is None:
                        burst_start_us = encoded.timestamp_us
                    clock_us = encoded.timestamp_us

            if event.transcript is not None:
                self.logger.debug(
                    "translation transcript kind=%s delta=%r",
                    event.transcript.kind,
                    event.transcript.delta,
                )
                if transcript is not None and event.transcript.kind == "output":
                    transcript.handle_delta(
                        event.transcript.delta,
                        clock_us=burst_start_us if burst_start_us is not None else clock_us,
                    )

    async def _close_session(self, session) -> None:
        with contextlib.suppress(Exception):
            await session.close()

    async def _log_session_stats(
        self, context: TranslationContext, provider_name: str
    ) -> None:
        while True:
            await asyncio.sleep(SESSION_STATS_LOG_INTERVAL_SECONDS)
            context.stats.log(
                self.logger,
                provider_name=provider_name,
                source_path=context.source_path,
                source_track=context.source_track,
                target_language=context.target_language,
            )

    async def _cancel_task(self, task: asyncio.Task[object]) -> None:
        if task.done():
            with contextlib.suppress(asyncio.CancelledError, Exception):
                task.result()
            return

        task.cancel()
        with contextlib.suppress(asyncio.CancelledError, Exception):
            await task


def _provider_label(name: object) -> str:
    normalized = str(name)
    labels = {
        "google": "Gemini",
    }
    return labels.get(normalized.lower(), normalized)
