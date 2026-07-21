"""Provider-neutral translation contracts."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol

from ..stats import SessionStats


@dataclass(frozen=True)
class PcmFormat:
    sample_rate: int
    channels: int
    sample_width: int = 2

    @property
    def bytes_per_frame(self) -> int:
        return self.channels * self.sample_width

    @property
    def layout(self) -> str:
        if self.channels == 1:
            return "mono"
        if self.channels == 2:
            return "stereo"
        raise ValueError(f"unsupported channel count: {self.channels}")

    def samples_for(self, data: bytes) -> int:
        if len(data) % self.bytes_per_frame != 0:
            raise ValueError("PCM payload is not aligned to whole audio samples")
        return len(data) // self.bytes_per_frame


@dataclass(frozen=True)
class PcmChunk:
    data: bytes
    format: PcmFormat
    # Presentation timestamp in microseconds. Provider output chunks may be sparse
    # when silence should be preserved between translated speech bursts.
    timestamp_us: int

    @property
    def samples(self) -> int:
        return self.format.samples_for(self.data)


@dataclass(frozen=True)
class TranscriptEvent:
    kind: str
    delta: str


@dataclass(frozen=True)
class ProviderEvent:
    audio: PcmChunk | None = None
    transcript: TranscriptEvent | None = None


@dataclass(frozen=True)
class TranslationContext:
    source_path: str
    source_track: str
    target_language: str
    stats: SessionStats = field(default_factory=SessionStats)


class TranslationSession(Protocol):
    input_format: PcmFormat
    output_format: PcmFormat

    async def send_audio(self, chunk: PcmChunk) -> None:
        """Send normalized PCM audio into the provider."""

    async def receive(self) -> ProviderEvent | None:
        """Receive translated PCM audio or transcript events."""

    async def close(self) -> None:
        """Close the provider session."""


class TranslationProvider(Protocol):
    async def start(self, context: TranslationContext) -> TranslationSession:
        """Start one provider session for one actively subscribed source track."""
