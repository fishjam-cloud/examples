"""Async MoQ translation service."""

from __future__ import annotations

import asyncio
import contextlib
import logging
from collections.abc import Sequence
from dataclasses import dataclass

from .catalog import AudioPublication, audio_publication, is_translation_path, translation_path
from .fishjam import fetch_moq_access
from .moq_compat import moq
from .providers import TranslationContext, TranslationProvider
from .providers.google import GoogleTranslationProvider
from .transcript import TranscriptPublisher, parse_transcript_track_name, transcript_track_name
from .translator import TrackTranslator


LOGGER = logging.getLogger(__name__)
TRANSLATION_UNUSED_GRACE_SECONDS = 5.0


@dataclass(frozen=True)
class TranslationSpec:
    provider_name: str
    target_language: str
    provider: TranslationProvider


@dataclass(frozen=True)
class TranslationGroup:
    provider_name: str
    provider: TranslationProvider
    languages: dict[str, str]


@dataclass(frozen=True)
class TranslationOutput:
    group: TranslationGroup
    path: str
    broadcast: moq.BroadcastProducer
    dynamic: object
    source: AudioPublication
    translator: TrackTranslator


class MediaFanout:
    def __init__(self, *, logger: logging.Logger = LOGGER) -> None:
        self.logger = logger
        self.empty = asyncio.Event()
        self.empty.set()
        self._media: list[moq.MediaProducer] = []
        self._demanding: list[moq.MediaProducer] = []

    @property
    def has_demand(self) -> bool:
        return bool(self._demanding)

    def add(self, media: moq.MediaProducer) -> None:
        self.mark_active(media)

    def mark_active(self, media: moq.MediaProducer) -> None:
        if not self._contains(self._media, media):
            self._media.append(media)
        if not self._contains(self._demanding, media):
            self._demanding.append(media)
        self.empty.clear()

    def mark_inactive(self, media: moq.MediaProducer) -> None:
        self._demanding = [item for item in self._demanding if item is not media]
        if not self._demanding:
            self.empty.set()

    def write_frame(self, payload: bytes, timestamp_us: int) -> None:
        for media in tuple(self._media):
            try:
                media.write_frame(payload, timestamp_us)
            except Exception:
                self.logger.debug(
                    "failed to write translated frame output_track=%s",
                    _safe_media_name(media),
                    exc_info=True,
                )

    def close(self) -> None:
        for media in tuple(self._media):
            with contextlib.suppress(Exception):
                media.finish()
        self._media.clear()
        self._demanding.clear()
        self.empty.set()

    @staticmethod
    def _contains(media: list[moq.MediaProducer], candidate: moq.MediaProducer) -> bool:
        return any(item is candidate for item in media)


@dataclass
class ActiveTranslation:
    transcript: TranscriptPublisher
    done: asyncio.Event
    media: MediaFanout


class TranslationService:
    def __init__(
        self,
        client: moq.Client,
        *,
        prefix: str = "",
        max_latency_ms: int = 10_000,
        translations: Sequence[TranslationSpec],
        logger: logging.Logger = LOGGER,
    ) -> None:
        if not translations:
            raise ValueError("at least one translation provider/language is required")

        self.client = client
        self.prefix = prefix
        self.max_latency_ms = max_latency_ms
        self.translations = tuple(translations)
        self.translation_groups = tuple(_translation_groups(self.translations))
        self.logger = logger
        self._broadcast_tasks: dict[str, asyncio.Task[None]] = {}

    async def run(self) -> None:
        self.logger.info("watching relay announcements prefix=%r", self.prefix)
        try:
            async for announcement in self.client.announced(self.prefix):
                path = announcement.path
                if is_translation_path(path):
                    self.logger.debug("skipping translation broadcast path=%s", path)
                    continue

                task = self._broadcast_tasks.get(path)
                if task is not None and not task.done():
                    self.logger.debug("broadcast is already being handled path=%s", path)
                    continue

                self.logger.info("new broadcast announced path=%s", path)
                task = asyncio.create_task(
                    self._handle_broadcast(path, announcement.broadcast),
                    name=f"broadcast:{path}",
                )
                self._broadcast_tasks[path] = task
                task.add_done_callback(lambda done, broadcast_path=path: self._log_task_result(broadcast_path, done))
        finally:
            await self._stop_broadcast_tasks()

    async def _handle_broadcast(self, source_path: str, source_broadcast: moq.BroadcastConsumer) -> None:
        try:
            catalog = await source_broadcast.catalog()
        except Exception:
            self.logger.exception("failed to read catalog source=%s", source_path)
            return

        audio_publications = self._audio_publications(source_path, catalog)
        if not audio_publications:
            self.logger.info("no supported audio tracks found source=%s", source_path)
            return

        source = audio_publications[0]
        if len(audio_publications) > 1:
            self.logger.info(
                "using first supported audio track source=%s selected_track=%s available_tracks=%s",
                source_path,
                source.source_name,
                ",".join(publication.source_name for publication in audio_publications),
            )

        outputs = self._publish_outputs(source_path, source)
        if not outputs:
            self.logger.info("no translation outputs announced source=%s", source_path)
            return

        track_tasks = [
            asyncio.create_task(
                self._serve_dynamic_translation_requests(source_path, output, source_broadcast),
                name=f"dynamic:{source_path}:{output.group.provider_name}",
            )
            for output in outputs
        ]

        try:
            await asyncio.gather(*track_tasks)
        finally:
            for task in track_tasks:
                task.cancel()
            await asyncio.gather(*track_tasks, return_exceptions=True)
            for output in outputs:
                self._finish_output(output)

    def _audio_publications(
        self,
        source_path: str,
        catalog: moq.Catalog,
    ) -> list[AudioPublication]:
        publications: list[AudioPublication] = []

        for source_name, audio in sorted(catalog.audio.items()):
            try:
                source = audio_publication(source_name, audio)
            except ValueError as exc:
                self.logger.warning(
                    "skipping audio track with unsupported parameters source=%s track=%s codec=%s reason=%s",
                    source_path,
                    source_name,
                    audio.codec,
                    exc,
                )
                continue

            if source is None:
                self.logger.info(
                    "skipping unsupported audio track source=%s track=%s codec=%s",
                    source_path,
                    source_name,
                    audio.codec,
                )
                continue

            publications.append(source)

        return publications

    def _publish_outputs(
        self,
        source_path: str,
        source: AudioPublication,
    ) -> list[TranslationOutput]:
        outputs: list[TranslationOutput] = []

        for group in self.translation_groups:
            output_path = translation_path(source_path, group.provider_name)
            output_broadcast = moq.BroadcastProducer()

            try:
                dynamic = output_broadcast.dynamic()
            except Exception:
                self.logger.exception(
                    "failed to create dynamic translation source=%s translation=%s provider=%s",
                    source_path,
                    output_path,
                    group.provider_name,
                )
                continue

            try:
                self.client.publish(output_path, output_broadcast)
            except Exception:
                self.logger.exception(
                    "failed to announce translation source=%s translation=%s",
                    source_path,
                    output_path,
                )
                with contextlib.suppress(Exception):
                    dynamic.cancel()
                with contextlib.suppress(Exception):
                    output_broadcast.finish()
                continue

            self.logger.info(
                "announcing dynamic translation source=%s translation=%s provider=%s languages=%s source_track=%s",
                source_path,
                output_path,
                group.provider_name,
                ",".join(group.languages.values()),
                source.source_name,
            )
            outputs.append(
                TranslationOutput(
                    group=group,
                    path=output_path,
                    broadcast=output_broadcast,
                    dynamic=dynamic,
                    source=source,
                    translator=TrackTranslator(group.provider, logger=self.logger),
                )
            )

        return outputs

    async def _serve_dynamic_translation_requests(
        self,
        source_path: str,
        output: TranslationOutput,
        source_broadcast: moq.BroadcastConsumer,
    ) -> None:
        request_tasks: set[asyncio.Task[None]] = set()
        active_translations: dict[str, ActiveTranslation] = {}

        try:
            while True:
                try:
                    requested_track = await output.dynamic.requested_track()
                except asyncio.CancelledError:
                    raise
                except Exception:
                    self.logger.exception(
                        "dynamic translation request loop failed source=%s translation=%s provider=%s",
                        source_path,
                        output.path,
                        output.group.provider_name,
                    )
                    return

                if requested_track is None:
                    self.logger.info(
                        "dynamic translation closed source=%s translation=%s provider=%s",
                        source_path,
                        output.path,
                        output.group.provider_name,
                    )
                    return

                transcript_language = parse_transcript_track_name(requested_track.name)
                if transcript_language is None:
                    handler = self._handle_requested_translation_track(
                        source_path,
                        output,
                        source_broadcast,
                        requested_track,
                        active_translations,
                    )
                    task_kind = "audio"
                else:
                    handler = self._handle_requested_transcript_track(
                        source_path,
                        output,
                        requested_track,
                        active_translations,
                    )
                    task_kind = "transcript"

                task = asyncio.create_task(
                    handler,
                    name=(
                        f"request:{task_kind}:{source_path}:"
                        f"{output.group.provider_name}:{requested_track.name}"
                    ),
                )
                request_tasks.add(task)
                task.add_done_callback(
                    lambda done, tasks=request_tasks, output_path=output.path: (
                        tasks.discard(done),
                        self._log_requested_track_result(output_path, done),
                    )
                )
        finally:
            with contextlib.suppress(Exception):
                output.dynamic.cancel()
            for task in request_tasks:
                task.cancel()
            await asyncio.gather(*request_tasks, return_exceptions=True)

    async def _handle_requested_translation_track(
        self,
        source_path: str,
        output: TranslationOutput,
        source_broadcast: moq.BroadcastConsumer,
        requested_track: moq.TrackProducer,
        active_translations: dict[str, ActiveTranslation],
    ) -> None:
        source = output.source
        source_name = source.source_name
        requested_language = requested_track.name.strip()
        target_language = output.group.languages.get(_language_key(requested_language))

        if target_language is None:
            self.logger.info(
                "rejecting unsupported translation request source=%s translation=%s "
                "provider=%s requested_track=%s allowed_languages=%s",
                source_path,
                output.path,
                output.group.provider_name,
                requested_track.name,
                ",".join(output.group.languages.values()),
            )
            self._finish_track(requested_track)
            return

        language_key = _language_key(target_language)
        active = active_translations.get(language_key)
        if active is not None and not active.done.is_set():
            output_media = self._publish_requested_translation_media(
                source_path=source_path,
                output=output,
                requested_track=requested_track,
                target_language=target_language,
            )
            if output_media is None:
                return

            active.media.add(output_media)
            self.logger.info(
                "attached translation subscriber source=%s translation=%s provider=%s "
                "target_language=%s output_track=%s",
                source_path,
                output.path,
                output.group.provider_name,
                target_language,
                output_media.name,
            )
            await self._serve_translation_media_demand(
                source_path=source_path,
                output=output,
                active=active,
                output_media=output_media,
                target_language=target_language,
            )
            return
        if active is not None:
            active_translations.pop(language_key, None)

        output_media = self._publish_requested_translation_media(
            source_path=source_path,
            output=output,
            requested_track=requested_track,
            target_language=target_language,
        )
        if output_media is None:
            return

        transcript = TranscriptPublisher(logger=self.logger)
        media = MediaFanout(logger=self.logger)
        media.add(output_media)
        active = ActiveTranslation(
            transcript=transcript,
            done=asyncio.Event(),
            media=media,
        )
        active_translations[language_key] = active

        self.logger.info(
            "starting translation source=%s source_track=%s translation=%s "
            "provider=%s target_language=%s output_track=%s transcript_track=%s",
            source_path,
            source_name,
            output.path,
            output.group.provider_name,
            target_language,
            output_media.name,
            transcript_track_name(target_language),
        )

        source_consumer: moq.MediaConsumer | None = None
        forward_task: asyncio.Task[None] | None = None
        empty_task: asyncio.Task[None] | None = None
        media_task: asyncio.Task[None] | None = None

        try:
            source_consumer = source_broadcast.subscribe_media(
                source_name,
                source.audio.container,
                self.max_latency_ms,
            )

            forward_task = asyncio.create_task(
                output.translator.run(
                    source_consumer=source_consumer,
                    output_media=media,
                    source=source,
                    context=TranslationContext(
                        source_path=source_path,
                        source_track=source_name,
                        target_language=target_language,
                    ),
                    transcript=transcript,
                ),
                name=f"forward:{source_path}:{source_name}:{target_language}",
            )
            media_task = asyncio.create_task(
                self._serve_translation_media_demand(
                    source_path=source_path,
                    output=output,
                    active=active,
                    output_media=output_media,
                    target_language=target_language,
                ),
                name=f"demand:{output.path}:{output_media.name}",
            )
            empty_task = asyncio.create_task(
                media.empty.wait(),
                name=f"empty:{output.path}:{target_language}",
            )

            while True:
                done, pending = await asyncio.wait(
                    {forward_task, empty_task},
                    return_when=asyncio.FIRST_COMPLETED,
                )

                if forward_task in done:
                    break

                if empty_task in done:
                    if media.has_demand:
                        empty_task = asyncio.create_task(
                            media.empty.wait(),
                            name=f"empty:{output.path}:{target_language}",
                        )
                        continue

                    source_consumer.cancel()
                    self.logger.info(
                        "closing translation; no active subscribers after grace source=%s "
                        "source_track=%s output_track=%s target_language=%s grace_seconds=%.1f",
                        source_path,
                        source_name,
                        output_media.name,
                        target_language,
                        TRANSLATION_UNUSED_GRACE_SECONDS,
                    )
                    return

            for task in pending:
                task.cancel()

            exc = forward_task.exception()
            if exc is not None:
                raise exc

            self.logger.info(
                "source audio ended source=%s source_track=%s output_track=%s target_language=%s",
                source_path,
                source_name,
                output_media.name,
                target_language,
            )
        except asyncio.CancelledError:
            if source_consumer is not None:
                source_consumer.cancel()
            raise
        except Exception:
            if source_consumer is not None:
                source_consumer.cancel()
            self.logger.exception(
                "translation failed source=%s source_track=%s output_track=%s target_language=%s",
                source_path,
                source_name,
                output_media.name,
                target_language,
            )
        finally:
            active.done.set()
            if active_translations.get(language_key) is active:
                del active_translations[language_key]
            if forward_task is not None:
                await self._cancel_task(forward_task)
            if empty_task is not None:
                await self._cancel_task(empty_task)
            if media_task is not None:
                await self._cancel_task(media_task)
            transcript.close()
            media.close()

    def _publish_requested_translation_media(
        self,
        *,
        source_path: str,
        output: TranslationOutput,
        requested_track: moq.TrackProducer,
        target_language: str,
    ) -> moq.MediaProducer | None:
        try:
            return output.broadcast.publish_requested_media(
                requested_track,
                output.source.format,
                output.source.init,
            )
        except Exception:
            self.logger.exception(
                "failed to create requested translation media source=%s translation=%s "
                "provider=%s target_language=%s requested_track=%s codec=%s",
                source_path,
                output.path,
                output.group.provider_name,
                target_language,
                requested_track.name,
                output.source.audio.codec,
            )
            self._finish_track(requested_track)
            return None

    async def _serve_translation_media_demand(
        self,
        *,
        source_path: str,
        output: TranslationOutput,
        active: ActiveTranslation,
        output_media: moq.MediaProducer,
        target_language: str,
    ) -> None:
        try:
            while not active.done.is_set():
                became_inactive = await self._wait_for_translation_unused_grace(
                    source_path=source_path,
                    output=output,
                    active=active,
                    output_media=output_media,
                    target_language=target_language,
                )
                if not became_inactive or active.done.is_set():
                    return

                active.media.mark_inactive(output_media)
                self.logger.info(
                    "translation media inactive after unused grace source=%s translation=%s "
                    "provider=%s target_language=%s output_track=%s",
                    source_path,
                    output.path,
                    output.group.provider_name,
                    target_language,
                    _safe_media_name(output_media),
                )

                became_active = await self._wait_for_translation_used_after_inactive(
                    source_path=source_path,
                    output=output,
                    active=active,
                    output_media=output_media,
                    target_language=target_language,
                )
                if not became_active:
                    return

                active.media.mark_active(output_media)
                self.logger.info(
                    "translation media active again source=%s translation=%s provider=%s "
                    "target_language=%s output_track=%s",
                    source_path,
                    output.path,
                    output.group.provider_name,
                    target_language,
                    _safe_media_name(output_media),
                )
        finally:
            active.media.mark_inactive(output_media)

    async def _wait_for_translation_used_after_inactive(
        self,
        *,
        source_path: str,
        output: TranslationOutput,
        active: ActiveTranslation,
        output_media: moq.MediaProducer,
        target_language: str,
    ) -> bool:
        used_task = asyncio.create_task(
            output_media.used(),
            name=f"used-inactive:{output.path}:{output_media.name}",
        )
        done_task = asyncio.create_task(
            active.done.wait(),
            name=f"translation-done:{output.path}:{target_language}:{output_media.name}",
        )

        try:
            done, _pending = await asyncio.wait(
                {used_task, done_task},
                return_when=asyncio.FIRST_COMPLETED,
            )
            if done_task in done:
                return False
            try:
                used_task.result()
            except Exception:
                self.logger.debug(
                    "translation used wait ended source=%s translation=%s provider=%s "
                    "target_language=%s output_track=%s",
                    source_path,
                    output.path,
                    output.group.provider_name,
                    target_language,
                    _safe_media_name(output_media),
                    exc_info=True,
                )
                return False
            return True
        finally:
            await self._cancel_task(used_task)
            await self._cancel_task(done_task)

    async def _wait_for_translation_unused_grace(
        self,
        *,
        source_path: str,
        output: TranslationOutput,
        active: ActiveTranslation,
        output_media: moq.MediaProducer,
        target_language: str,
    ) -> bool:
        while True:
            unused_task = asyncio.create_task(
                output_media.unused(),
                name=f"unused:{output.path}:{output_media.name}",
            )
            done_task = asyncio.create_task(
                active.done.wait(),
                name=f"translation-done:{output.path}:{target_language}:{output_media.name}",
            )
            try:
                done, _pending = await asyncio.wait(
                    {unused_task, done_task},
                    return_when=asyncio.FIRST_COMPLETED,
                )
                if done_task in done:
                    return False
                try:
                    unused_task.result()
                except Exception:
                    self.logger.debug(
                        "translation unused wait ended source=%s translation=%s provider=%s "
                        "target_language=%s output_track=%s",
                        source_path,
                        output.path,
                        output.group.provider_name,
                        target_language,
                        _safe_media_name(output_media),
                        exc_info=True,
                    )
                    return False
            finally:
                await self._cancel_task(unused_task)
                await self._cancel_task(done_task)

            self.logger.info(
                "translation unused; waiting for subscribers source=%s translation=%s "
                "provider=%s target_language=%s output_track=%s grace_seconds=%.1f",
                source_path,
                output.path,
                output.group.provider_name,
                target_language,
                output_media.name,
                TRANSLATION_UNUSED_GRACE_SECONDS,
            )

            used_task = asyncio.create_task(
                output_media.used(),
                name=f"used:{output.path}:{output_media.name}",
            )
            done_task = asyncio.create_task(
                active.done.wait(),
                name=f"translation-done:{output.path}:{target_language}:{output_media.name}",
            )
            try:
                done, _pending = await asyncio.wait(
                    {used_task, done_task},
                    timeout=TRANSLATION_UNUSED_GRACE_SECONDS,
                    return_when=asyncio.FIRST_COMPLETED,
                )
                if done_task in done:
                    return False
                if used_task not in done:
                    return True
                try:
                    used_task.result()
                except Exception:
                    self.logger.debug(
                        "translation used wait ended source=%s translation=%s provider=%s "
                        "target_language=%s output_track=%s",
                        source_path,
                        output.path,
                        output.group.provider_name,
                        target_language,
                        _safe_media_name(output_media),
                        exc_info=True,
                    )
                    return False
            finally:
                await self._cancel_task(used_task)
                await self._cancel_task(done_task)

            self.logger.info(
                "translation reused during unused grace source=%s translation=%s "
                "provider=%s target_language=%s output_track=%s",
                source_path,
                output.path,
                output.group.provider_name,
                target_language,
                output_media.name,
            )

    async def _handle_requested_transcript_track(
        self,
        source_path: str,
        output: TranslationOutput,
        requested_track: moq.TrackProducer,
        active_translations: dict[str, ActiveTranslation],
    ) -> None:
        requested_language = parse_transcript_track_name(requested_track.name)
        if requested_language is None:
            self._finish_track(requested_track)
            return

        target_language = output.group.languages.get(_language_key(requested_language))
        if target_language is None:
            self.logger.info(
                "rejecting unsupported transcript request source=%s translation=%s "
                "provider=%s requested_track=%s allowed_languages=%s",
                source_path,
                output.path,
                output.group.provider_name,
                requested_track.name,
                ",".join(output.group.languages.values()),
            )
            self._finish_track(requested_track)
            return

        language_key = _language_key(target_language)
        active = active_translations.get(language_key)
        if active is None or active.done.is_set():
            self.logger.info(
                "rejecting transcript request without active audio source=%s translation=%s "
                "provider=%s target_language=%s requested_track=%s",
                source_path,
                output.path,
                output.group.provider_name,
                target_language,
                requested_track.name,
            )
            self._finish_track(requested_track)
            return

        self.logger.info(
            "starting transcript stream source=%s translation=%s provider=%s "
            "target_language=%s track=%s",
            source_path,
            output.path,
            output.group.provider_name,
            target_language,
            requested_track.name,
        )

        active.transcript.attach(requested_track)
        unused_task = asyncio.create_task(
            requested_track.unused(),
            name=f"unused-transcript:{output.path}:{requested_track.name}",
        )
        audio_done_task = asyncio.create_task(
            active.done.wait(),
            name=f"audio-done:{output.path}:{target_language}",
        )

        try:
            done, _pending = await asyncio.wait(
                {unused_task, audio_done_task},
                return_when=asyncio.FIRST_COMPLETED,
            )
            if unused_task in done:
                self.logger.info(
                    "closing transcript stream; no active subscribers source=%s "
                    "translation=%s target_language=%s track=%s",
                    source_path,
                    output.path,
                    target_language,
                    requested_track.name,
                )
            else:
                self.logger.info(
                    "closing transcript stream; audio translation stopped source=%s "
                    "translation=%s target_language=%s track=%s",
                    source_path,
                    output.path,
                    target_language,
                    requested_track.name,
                )
        finally:
            await self._cancel_task(unused_task)
            await self._cancel_task(audio_done_task)
            active.transcript.detach(requested_track)

    def _finish_track(self, track: moq.TrackProducer) -> None:
        with contextlib.suppress(Exception):
            track.finish()

    async def _stop_broadcast_tasks(self) -> None:
        tasks = list(self._broadcast_tasks.values())
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)

    async def _cancel_task(self, task: asyncio.Task[object]) -> None:
        if task.done():
            with contextlib.suppress(asyncio.CancelledError, Exception):
                task.result()
            return

        task.cancel()
        with contextlib.suppress(asyncio.CancelledError, Exception):
            await task

    def _finish_output(self, output: TranslationOutput) -> None:
        with contextlib.suppress(Exception):
            output.dynamic.cancel()
        with contextlib.suppress(Exception):
            output.broadcast.finish()

    def _log_requested_track_result(self, output_path: str, task: asyncio.Task[None]) -> None:
        if task.cancelled():
            return
        try:
            task.result()
        except asyncio.CancelledError:
            return
        except Exception:
            self.logger.exception("requested translation track task failed translation=%s", output_path)

    def _log_task_result(self, broadcast_path: str, task: asyncio.Task[None]) -> None:
        if task.cancelled():
            return
        try:
            task.result()
        except asyncio.CancelledError:
            return
        except Exception:
            self.logger.exception("broadcast task failed path=%s", broadcast_path)


def _provider_name(provider: TranslationProvider, override: str | None) -> str:
    if override is not None:
        if not override.strip():
            raise ValueError("provider_name must not be empty")
        return override

    name = getattr(provider, "name", None)
    if isinstance(name, str) and name.strip():
        return name

    raise ValueError("provider_name must be provided when provider has no name")


def _safe_media_name(media: moq.MediaProducer) -> str:
    with contextlib.suppress(Exception):
        return media.name
    return "<closed>"


async def run(
    *,
    url: str,
    prefix: str = "",
    tls_verify: bool = True,
    max_latency_ms: int = 10_000,
    provider: TranslationProvider | None = None,
    provider_name: str | None = None,
    providers: Sequence[tuple[str, TranslationProvider]] | None = None,
    translations: Sequence[TranslationSpec] | None = None,
) -> None:
    translations = _translation_specs(
        translations=translations,
        provider=provider,
        provider_name=provider_name,
        providers=providers,
    )
    publish_origin = moq.OriginProducer()
    subscribe_origin = moq.OriginProducer()

    async with moq.Client(
        url,
        tls_verify=tls_verify,
        publish=publish_origin,
        subscribe=subscribe_origin,
    ) as client:
        service = TranslationService(
            client,
            prefix=prefix,
            max_latency_ms=max_latency_ms,
            translations=translations,
        )
        await service.run()


TOKEN_REFRESH_MARGIN_SECONDS = 300.0
RECONNECT_DELAY_SECONDS = 5.0


async def run_with_fishjam(
    *,
    fishjam_id: str,
    management_token: str,
    prefix: str = "",
    token_ttl: float = 3600.0,
    tls_verify: bool = True,
    max_latency_ms: int = 10_000,
    provider: TranslationProvider | None = None,
    provider_name: str | None = None,
    providers: Sequence[tuple[str, TranslationProvider]] | None = None,
    translations: Sequence[TranslationSpec] | None = None,
) -> None:
    """Run the service against Fishjam, refreshing the MoQ token before it expires.

    Requests a token scoped to ``prefix`` for both publish and subscribe, so a
    single connection covers every broadcast under the account root.
    """
    translations = _translation_specs(
        translations=translations,
        provider=provider,
        provider_name=provider_name,
        providers=providers,
    )
    reconnect_after = max(token_ttl - TOKEN_REFRESH_MARGIN_SECONDS, token_ttl / 2)

    while True:
        try:
            access = await fetch_moq_access(
                fishjam_id,
                management_token,
                publish_path=prefix,
                subscribe_path=prefix,
            )
        except Exception:
            LOGGER.exception(
                "failed to fetch MoQ access from Fishjam; retrying in %ss",
                RECONNECT_DELAY_SECONDS,
            )
            await asyncio.sleep(RECONNECT_DELAY_SECONDS)
            continue

        LOGGER.info("acquired MoQ token; connecting to %s", access.connection_url.split("?")[0])
        try:
            async with asyncio.timeout(reconnect_after):
                await run(
                    url=access.connection_url,
                    prefix=prefix,
                    tls_verify=tls_verify,
                    max_latency_ms=max_latency_ms,
                    translations=translations,
                )
        except TimeoutError:
            LOGGER.info("MoQ token expiring; refreshing and reconnecting")
        except Exception:
            LOGGER.exception(
                "MoQ connection failed; reconnecting in %ss", RECONNECT_DELAY_SECONDS
            )
            await asyncio.sleep(RECONNECT_DELAY_SECONDS)


def _translation_specs(
    *,
    translations: Sequence[TranslationSpec] | None,
    provider: TranslationProvider | None,
    provider_name: str | None,
    providers: Sequence[tuple[str, TranslationProvider]] | None,
) -> tuple[TranslationSpec, ...]:
    if translations is not None:
        return _validate_translation_specs(translations)

    provider_specs = _provider_specs(provider, provider_name, providers)
    specs = []
    seen: set[tuple[str, str]] = set()

    for name, provider in provider_specs:
        name = _provider_name(provider, name)
        for language in supported_target_languages(provider):
            key = (name, language)
            if key in seen:
                raise ValueError(
                    f"duplicate translation target: provider={name} target_language={language}"
                )
            seen.add(key)
            specs.append(
                TranslationSpec(
                    provider_name=name,
                    target_language=language,
                    provider=provider,
                )
            )

    return tuple(specs)


def _validate_translation_specs(
    translations: Sequence[TranslationSpec],
) -> tuple[TranslationSpec, ...]:
    if not translations:
        raise ValueError("at least one translation provider/language is required")

    specs = []
    seen: set[tuple[str, str]] = set()
    for spec in translations:
        provider_name = _provider_name(spec.provider, spec.provider_name)
        target_language = _canonical_supported_language(
            spec.provider,
            spec.target_language,
            provider_name,
        )

        key = (provider_name, target_language)
        if key in seen:
            raise ValueError(
                f"duplicate translation target: provider={provider_name} target_language={target_language}"
            )
        seen.add(key)
        specs.append(
            TranslationSpec(
                provider_name=provider_name,
                target_language=target_language,
                provider=spec.provider,
            )
        )

    return tuple(specs)


def _translation_groups(translations: Sequence[TranslationSpec]) -> list[TranslationGroup]:
    groups: dict[str, TranslationGroup] = {}

    for spec in translations:
        provider_name = _provider_name(spec.provider, spec.provider_name)
        target_language = _canonical_supported_language(
            spec.provider,
            spec.target_language,
            provider_name,
        )

        group = groups.get(provider_name)
        if group is None:
            group = TranslationGroup(
                provider_name=provider_name,
                provider=spec.provider,
                languages={},
            )
            groups[provider_name] = group

        language_key = _language_key(target_language)
        if language_key in group.languages:
            raise ValueError(
                f"duplicate translation target for provider={provider_name}: "
                f"{target_language} conflicts with {group.languages[language_key]}"
            )
        group.languages[language_key] = target_language

    return list(groups.values())


def _language_key(language: str) -> str:
    return language.strip().lower()


def _provider_specs(
    provider: TranslationProvider | None,
    provider_name: str | None,
    providers: Sequence[tuple[str, TranslationProvider]] | None,
) -> Sequence[tuple[str, TranslationProvider]]:
    if providers is not None:
        if not providers:
            raise ValueError("at least one provider is required")
        return providers

    provider = provider or GoogleTranslationProvider()
    return [(_provider_name(provider, provider_name), provider)]


def supported_target_languages(provider: TranslationProvider) -> tuple[str, ...]:
    languages = tuple(
        language.strip()
        for language in getattr(provider, "supported_target_languages", ())
        if language.strip()
    )
    if not languages:
        raise ValueError(f"provider has no supported target languages: {provider!r}")
    return languages


def _canonical_supported_language(
    provider: TranslationProvider,
    language: str,
    provider_name: str,
) -> str:
    requested = language.strip()
    if not requested:
        raise ValueError("target language must not be empty")

    supported = {
        _language_key(supported_language): supported_language
        for supported_language in supported_target_languages(provider)
    }
    canonical = supported.get(_language_key(requested))
    if canonical is None:
        supported_values = ", ".join(supported.values())
        raise ValueError(
            f"unsupported target language for provider={provider_name}: "
            f"{requested}; supported: {supported_values}"
        )
    return canonical
