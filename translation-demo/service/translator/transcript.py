"""Publishing translated transcript text to a raw MoQ caption track."""

from __future__ import annotations

import asyncio
import contextlib
import json
import logging
from dataclasses import dataclass

import moq_net as moq


LOGGER = logging.getLogger(__name__)

# Wire contract (v2) shared with the videoroom client: each caption update is
# one group containing a single UTF-8 frame with the full current caption
# state as JSON (replace semantics):
#
#   {"segments": [{"text": str, "ts_us": int, "final": bool}, ...]}
#
# `ts_us` is the segment start on the same output clock as the translated
# audio frame timestamps; the client holds each segment until audio playback
# reaches it. `{"segments": []}` clears the caption. A segment's `ts_us` never
# changes once published (the client keys per-segment display timing on it).
# The track is not advertised in the Hang catalog (the FFI catalog only
# carries audio/video), so clients subscribe to the dynamic text track that
# belongs to the active audio language track directly.
TRANSCRIPT_TRACK_SUFFIX = "transcript.json"

IDLE_CLEAR_SECONDS = 4.0
# Drop segments this much older than the newest output audio position.
WINDOW_US = 15_000_000
# Close a segment once it grows past this, even mid-sentence.
MAX_SEGMENT_CHARS = 80
# Hard cap on the published window, newest segments win.
MAX_SEGMENTS = 12

_SENTENCE_ENDINGS = (".", "!", "?", "…", "。", "！", "？")


@dataclass
class _Segment:
    text: str
    ts_us: int
    final: bool = False


class TranscriptPublisher:
    """Groups provider transcript deltas and publishes them to attached tracks."""

    def __init__(
        self,
        *,
        idle_clear_seconds: float = IDLE_CLEAR_SECONDS,
        logger: logging.Logger = LOGGER,
    ) -> None:
        self.idle_clear_seconds = idle_clear_seconds
        self.logger = logger
        self._tracks: list[moq.TrackProducer] = []
        self._segments: list[_Segment] = []
        self._clear_task: asyncio.Task[None] | None = None

    def attach(self, track: moq.TrackProducer) -> None:
        """Attach a requested transcript track to this active audio translation."""
        if not self._contains(track):
            self._tracks.append(track)
        self._publish(track)

    def detach(self, track: moq.TrackProducer, *, finish: bool = True) -> None:
        self._tracks = [attached for attached in self._tracks if attached is not track]
        if finish:
            with contextlib.suppress(Exception):
                track.finish()

    def handle_delta(self, delta: str, *, clock_us: int = 0) -> None:
        """Append a provider transcript delta at the given output-audio position.

        `clock_us` is the output clock of the audio burst the delta belongs to
        (the first encoded frame of the burst, or the running clock when the
        text arrives ahead of its audio). It stamps newly started segments
        only; an existing open segment keeps its original timestamp.
        """
        if not delta:
            return

        current = self._segments[-1] if self._segments and not self._segments[-1].final else None
        if current is None:
            current = _Segment(text="", ts_us=int(clock_us))
            self._segments.append(current)
        current.text += delta

        if current.text.rstrip().endswith(_SENTENCE_ENDINGS) or len(current.text) >= MAX_SEGMENT_CHARS:
            current.final = True

        self._expire(int(clock_us))
        self._publish()
        self._restart_clear_timer()

    def close(self) -> None:
        """Clear published captions, finish attached tracks, and stop the idle timer."""
        self._cancel_clear_timer()
        self._clear()
        for track in tuple(self._tracks):
            self.detach(track)

    def _expire(self, clock_us: int) -> None:
        horizon = max(clock_us, *(segment.ts_us for segment in self._segments)) - WINDOW_US
        self._segments = [
            segment for segment in self._segments if segment.ts_us >= horizon or not segment.final
        ]
        if len(self._segments) > MAX_SEGMENTS:
            self._segments = self._segments[-MAX_SEGMENTS:]

    def _clear(self) -> None:
        if not self._segments:
            return
        self._segments = []
        self._publish()

    def _publish(self, track: moq.TrackProducer | None = None) -> None:
        payload = json.dumps(
            {
                "segments": [
                    {"text": segment.text.strip(), "ts_us": segment.ts_us, "final": segment.final}
                    for segment in self._segments
                    if segment.text.strip()
                ]
            },
            ensure_ascii=False,
        ).encode("utf-8")

        tracks = (track,) if track is not None else tuple(self._tracks)
        for attached in tracks:
            try:
                attached.write_frame(payload)
            except Exception:
                self.logger.debug("failed to write transcript frame", exc_info=True)

    def _restart_clear_timer(self) -> None:
        self._cancel_clear_timer()
        self._clear_task = asyncio.create_task(
            self._clear_after_idle(),
            name="transcript-clear",
        )

    def _cancel_clear_timer(self) -> None:
        if self._clear_task is not None:
            self._clear_task.cancel()
            self._clear_task = None

    async def _clear_after_idle(self) -> None:
        await asyncio.sleep(self.idle_clear_seconds)
        self._clear()

    def _contains(self, track: moq.TrackProducer) -> bool:
        return any(attached is track for attached in self._tracks)


def transcript_track_name(language: str) -> str:
    language = language.strip()
    if not language:
        raise ValueError("language must not be empty")
    return f"{language}/{TRANSCRIPT_TRACK_SUFFIX}"


def parse_transcript_track_name(track_name: str) -> str | None:
    language, separator, suffix = track_name.strip().partition("/")
    if not separator or not language or suffix != TRANSCRIPT_TRACK_SUFFIX:
        return None
    return language
