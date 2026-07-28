"""Helpers for creating output audio tracks from Hang catalog entries."""

from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import quote

from .moq_compat import moq


SAMPLE_RATE_INDEX = {
    96_000: 0,
    88_200: 1,
    64_000: 2,
    48_000: 3,
    44_100: 4,
    32_000: 5,
    24_000: 6,
    22_050: 7,
    16_000: 8,
    12_000: 9,
    11_025: 10,
    8_000: 11,
    7_350: 12,
}


@dataclass(frozen=True)
class AudioPublication:
    """A source audio track that can be represented as a publishable output track."""

    source_name: str
    audio: moq.Audio
    format: str
    init: bytes


def translation_path(source_path: str, provider_name: str) -> str:
    """Return the translated broadcast path for a source broadcast."""
    provider_segment = quote(provider_name.strip(), safe="")
    if not provider_segment:
        raise ValueError("provider name must not be empty")

    return f"{source_path.rstrip('/')}/{provider_segment}/translation"


def is_translation_path(path: str) -> bool:
    return "translation" in path.rstrip("/").split("/")


def audio_publication(source_name: str, audio: moq.Audio) -> AudioPublication | None:
    """Build the publish-media arguments for a supported source audio track."""
    codec = codec_family(audio.codec)
    if not 0 < audio.channel_count <= 2:
        raise ValueError(f"unsupported translation channel count: {audio.channel_count}")

    if codec == "opus":
        return AudioPublication(
            source_name=source_name,
            audio=audio,
            format="opus",
            init=opus_head(audio.sample_rate, audio.channel_count),
        )

    if codec == "aac":
        return AudioPublication(
            source_name=source_name,
            audio=audio,
            format="aac",
            init=audio_specific_config(
                profile=2,
                sample_rate=audio.sample_rate,
                channel_count=audio.channel_count,
            ),
        )

    return None


def codec_family(codec: str) -> str:
    codec = codec.lower()
    if codec == "opus":
        return "opus"
    if codec == "aac" or codec.startswith("mp4a.40."):
        return "aac"
    return codec


def opus_head(sample_rate: int, channel_count: int) -> bytes:
    if not 0 < channel_count <= 255:
        raise ValueError(f"unsupported Opus channel count: {channel_count}")
    if not 0 < sample_rate <= 0xFFFFFFFF:
        raise ValueError(f"unsupported Opus sample rate: {sample_rate}")

    return b"".join(
        [
            b"OpusHead",
            bytes([1, channel_count]),
            (0).to_bytes(2, "little"),
            sample_rate.to_bytes(4, "little"),
            (0).to_bytes(2, "little"),
            bytes([0]),
        ]
    )


def aac_init(audio: moq.Audio) -> bytes:
    if audio.description:
        return bytes(audio.description)

    return audio_specific_config(
        profile=aac_profile(audio.codec),
        sample_rate=audio.sample_rate,
        channel_count=audio.channel_count,
    )


def aac_profile(codec: str) -> int:
    codec = codec.lower()
    if codec.startswith("mp4a.40."):
        try:
            profile = int(codec.removeprefix("mp4a.40."))
        except ValueError as exc:
            raise ValueError(f"unsupported AAC codec string: {codec}") from exc
    else:
        profile = 2

    if not 0 < profile < 31:
        raise ValueError(f"unsupported AAC profile: {profile}")
    return profile


def audio_specific_config(profile: int, sample_rate: int, channel_count: int) -> bytes:
    if not 0 < channel_count <= 7:
        raise ValueError(f"unsupported AAC channel count: {channel_count}")

    frequency_index = SAMPLE_RATE_INDEX.get(sample_rate, 15)
    first = (profile << 3) | (frequency_index >> 1)
    second = ((frequency_index & 1) << 7) | (channel_count << 3)
    config = bytes([first, second])

    if frequency_index == 15:
        if not 0 < sample_rate <= 0xFFFFFF:
            raise ValueError(f"unsupported AAC sample rate: {sample_rate}")
        config += sample_rate.to_bytes(3, "big")

    return config
