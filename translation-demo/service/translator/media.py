"""Provider-neutral audio decoding, resampling, and encoding."""

from __future__ import annotations

import logging
import time
from collections import deque
from dataclasses import dataclass
from fractions import Fraction
from typing import Deque

import av
from av.audio.fifo import AudioFifo
from av.audio.frame import AudioFrame
from av.audio.resampler import AudioResampler

from .catalog import aac_init, codec_family, opus_head
from .moq_compat import moq
from .providers import PcmChunk, PcmFormat
from .stats import SessionStats


LOGGER = logging.getLogger(__name__)


@dataclass(frozen=True)
class EncodedFrame:
    payload: bytes
    timestamp_us: int


class AudioTranslationPipeline:
    """Decode source media frames and encode provider PCM output."""

    def __init__(
        self,
        audio: moq.Audio,
        *,
        provider_input: PcmFormat,
        provider_output: PcmFormat,
        stats: SessionStats | None = None,
    ) -> None:
        self.provider_output = provider_output
        self.stats = stats or SessionStats()
        self.decoder = AudioDecoder(audio)
        self.input_resampler = PcmFrameResampler(provider_input)
        self.encoder = AudioEncoder(audio)
        self.output_resampler = AudioFrameResampler(
            format_name=self.encoder.sample_format,
            sample_rate=self.encoder.sample_rate,
            channels=self.encoder.channels,
        )
        self._last_source_frame_timestamp_us: int | None = None
        self._last_decoded_end_us: int | None = None
        self._last_provider_input_end_us: int | None = None
        self._last_provider_output_end_us: int | None = None
        self._last_output_resampled_end_us: int | None = None
        self._last_encoded_timestamp_us: int | None = None

    def decode_source(self, frame: moq.Frame) -> list[PcmChunk]:
        start_ns = time.perf_counter_ns()
        payload = bytes(frame.payload)
        timestamp_us = int(frame.timestamp_us)
        try:
            _log_timestamp_delta(
                "source media frame",
                timestamp_us,
                self._last_source_frame_timestamp_us,
                payload_bytes=len(payload),
            )
            self._last_source_frame_timestamp_us = timestamp_us

            chunks: list[PcmChunk] = []
            for decoded in self.decoder.decode(payload, timestamp_us):
                # _log_audio_frame_interval(
                #     "decoded source audio",
                #     decoded,
                #     self._last_decoded_end_us,
                # )
                self._last_decoded_end_us = _audio_frame_end_us(decoded)
                for chunk in self.input_resampler.resample(decoded):
                    # _log_pcm_chunk_interval(
                    #     "provider input pcm",
                    #     chunk,
                    #     self._last_provider_input_end_us,
                    # )
                    self._last_provider_input_end_us = _pcm_chunk_end_us(chunk)
                    chunks.append(chunk)
            return chunks
        finally:
            self.stats.record_decode_timing(_elapsed_us(start_ns))

    def encode_translation(self, chunk: PcmChunk) -> list[EncodedFrame]:
        start_ns = time.perf_counter_ns()
        try:
            if chunk.format != self.provider_output:
                raise ValueError(
                    f"expected provider output {self.provider_output}, got {chunk.format}"
                )
            _log_pcm_chunk_interval(
                "provider output pcm",
                chunk,
                self._last_provider_output_end_us,
            )
            self._last_provider_output_end_us = _pcm_chunk_end_us(chunk)
            frames = self.output_resampler.resample(pcm_chunk_to_frame(chunk))
            return self._encode_output_frames(frames)
        finally:
            self.stats.record_encode_timing(_elapsed_us(start_ns))

    def finish(self) -> list[EncodedFrame]:
        start_ns = time.perf_counter_ns()
        try:
            encoded: list[EncodedFrame] = []
            encoded.extend(self._encode_output_frames(self.output_resampler.finish()))
            final_frames = self.encoder.finish()
            self._log_encoded_frames(final_frames)
            encoded.extend(final_frames)
            return encoded
        finally:
            self.stats.record_encode_timing(_elapsed_us(start_ns))

    def _encode_output_frames(self, frames: list[AudioFrame]) -> list[EncodedFrame]:
        for frame in frames:
            # _log_audio_frame_interval(
            #     "output resampled audio",
            #     frame,
            #     self._last_output_resampled_end_us,
            # )
            self._last_output_resampled_end_us = _audio_frame_end_us(frame)
        encoded = self.encoder.encode(frames)
        self._log_encoded_frames(encoded)
        return encoded

    def _log_encoded_frames(self, frames: list[EncodedFrame]) -> None:
        for frame in frames:
            # _log_timestamp_delta(
            #     "encoded output frame",
            #     frame.timestamp_us,
            #     self._last_encoded_timestamp_us,
            #     payload_bytes=len(frame.payload),
            # )
            self._last_encoded_timestamp_us = frame.timestamp_us


class AudioDecoder:
    def __init__(self, audio: moq.Audio) -> None:
        self.audio = audio
        self.family = codec_family(audio.codec)
        self.context = av.CodecContext.create(self.family, "r")
        self.context.sample_rate = int(audio.sample_rate)
        self.context.layout = layout_name(int(audio.channel_count))

        if self.family == "aac":
            self.context.extradata = aac_init(audio)
        elif self.family == "opus":
            self.context.extradata = opus_head(
                int(audio.sample_rate), int(audio.channel_count)
            )

        self.context.open()

    def decode(self, payload: bytes, timestamp_us: int) -> list[AudioFrame]:
        packet = av.Packet(payload)
        frames = self.context.decode(packet)
        offset_samples = 0

        for frame in frames:
            sample_rate = int(frame.sample_rate or self.audio.sample_rate)
            expected_pts = timestamp_us * sample_rate // 1_000_000 + offset_samples
            expected_timestamp_us = expected_pts * 1_000_000 // sample_rate
            if frame.pts is not None:
                assert frame.time_base is not None, (
                    "decoded frame has a PTS but no time base to compare against "
                    "the MoQ frame timestamp"
                )
                frame_timestamp_us = int(frame.pts * frame.time_base * 1_000_000)
                assert frame_timestamp_us == expected_timestamp_us, (
                    "decoded frame timestamp does not match MoQ frame timestamp: "
                    f"decoded={frame_timestamp_us} expected={expected_timestamp_us}"
                )

            frame.pts = expected_pts
            frame.time_base = Fraction(1, sample_rate)
            offset_samples += frame.samples

        return frames


class PcmFrameResampler:
    def __init__(self, output_format: PcmFormat) -> None:
        self.output_format = output_format
        self.resampler = AudioResampler(
            format="s16", layout=output_format.layout, rate=output_format.sample_rate
        )

    def resample(self, frame: AudioFrame) -> list[PcmChunk]:
        chunks: list[PcmChunk] = []
        for pcm_frame in self.resampler.resample(frame):
            data = pcm_frame_to_bytes(pcm_frame, self.output_format)
            timestamp_us = frame_timestamp_us(pcm_frame)
            chunks.append(
                PcmChunk(
                    data=data, format=self.output_format, timestamp_us=timestamp_us
                )
            )
        return chunks


class AudioFrameResampler:
    def __init__(self, *, format_name: str, sample_rate: int, channels: int) -> None:
        self.format_name = format_name
        self.sample_rate = sample_rate
        self.channels = channels
        self.resampler = self._create_resampler()
        self._segment_base_timestamp_us: int | None = None
        self._segment_input_end_us: int | None = None
        self._input_sample_rate: int | None = None
        self._next_input_local_sample = 0
        self._continuity_tolerance_us = max(1, 2_000_000 // sample_rate)

    def resample(self, frame: AudioFrame) -> list[AudioFrame]:
        input_sample_rate = int(frame.sample_rate)
        frame_start_us = frame_timestamp_us(frame)
        output: list[AudioFrame] = []

        if (
            self._segment_base_timestamp_us is None
            or self._input_sample_rate != input_sample_rate
        ):
            if self._segment_base_timestamp_us is not None:
                output.extend(self.finish())
                self._reset_segment()
            self._start_segment(frame_start_us, input_sample_rate)
        else:
            assert self._segment_input_end_us is not None
            gap_us = frame_start_us - self._segment_input_end_us
            if gap_us > self._continuity_tolerance_us:
                output.extend(self.finish())
                LOGGER.debug(
                    "resetting audio resampler segment gap_ms=%.1f previous_end_ms=%.1f next_audio_ms=%.1f",
                    gap_us / 1_000,
                    self._segment_input_end_us / 1_000,
                    frame_start_us / 1_000,
                )
                self._reset_segment()
                self._start_segment(frame_start_us, input_sample_rate)

        frame.pts = self._next_input_local_sample
        frame.time_base = Fraction(1, input_sample_rate)
        output.extend(self._retimestamp_output(self.resampler.resample(frame)))

        self._next_input_local_sample += frame.samples
        assert self._segment_base_timestamp_us is not None
        self._segment_input_end_us = (
            self._segment_base_timestamp_us
            + self._next_input_local_sample * 1_000_000 // input_sample_rate
        )
        return output

    def finish(self) -> list[AudioFrame]:
        return self._retimestamp_output(self.resampler.resample(None))

    def _create_resampler(self) -> AudioResampler:
        return AudioResampler(
            format=self.format_name,
            layout=layout_name(self.channels),
            rate=self.sample_rate,
        )

    def _start_segment(self, timestamp_us: int, input_sample_rate: int) -> None:
        self._segment_base_timestamp_us = timestamp_us
        self._segment_input_end_us = timestamp_us
        self._input_sample_rate = input_sample_rate
        self._next_input_local_sample = 0

    def _reset_segment(self) -> None:
        self.resampler = self._create_resampler()
        self._segment_base_timestamp_us = None
        self._segment_input_end_us = None
        self._input_sample_rate = None
        self._next_input_local_sample = 0

    def _retimestamp_output(self, frames: list[AudioFrame]) -> list[AudioFrame]:
        if self._segment_base_timestamp_us is None:
            return frames

        for frame in frames:
            sample_rate = int(frame.sample_rate or self.sample_rate)
            local_sample = int(frame.pts or 0)
            base_sample = self._segment_base_timestamp_us * sample_rate // 1_000_000
            frame.pts = base_sample + local_sample
            frame.time_base = Fraction(1, sample_rate)
        return frames


class AudioEncoder:
    def __init__(self, audio: moq.Audio) -> None:
        self.family = codec_family(audio.codec)
        self.sample_rate = int(audio.sample_rate)
        self.channels = int(audio.channel_count)
        self.sample_format = encoder_sample_format(self.family)
        self.bit_rate = int(
            audio.bitrate or default_bit_rate(self.family, self.channels)
        )
        self.context = self._create_context()
        self.fifo = AudioFifo()
        self.frame_size = self.context.frame_size or max(1, self.sample_rate // 50)
        self._queued_timestamps: Deque[int] = deque()
        self._segment_base_timestamp_us: int | None = None
        self._segment_end_timestamp_us: int | None = None
        self._next_local_sample = 0
        self._continuity_tolerance_us = max(1, 2_000_000 // self.sample_rate)

    def encode(self, frames: list[AudioFrame]) -> list[EncodedFrame]:
        encoded: list[EncodedFrame] = []
        for frame in frames:
            encoded.extend(self._write_frame(frame))
        return encoded

    def finish(self) -> list[EncodedFrame]:
        return self._finish_segment()

    def _create_context(self) -> av.CodecContext:
        context = av.CodecContext.create(encoder_name(self.family), "w")
        context.sample_rate = self.sample_rate
        context.layout = layout_name(self.channels)
        context.format = self.sample_format
        context.bit_rate = self.bit_rate
        context.time_base = Fraction(1, self.sample_rate)
        context.open()
        return context

    def _write_frame(self, frame: AudioFrame) -> list[EncodedFrame]:
        if int(frame.sample_rate) != self.sample_rate:
            raise ValueError(
                f"expected {self.sample_rate} Hz encoder frame, got {frame.sample_rate}"
            )

        encoded: list[EncodedFrame] = []
        frame_start_us = frame_timestamp_us(frame)

        if self._segment_base_timestamp_us is None:
            self._start_segment(frame_start_us)
        else:
            assert self._segment_end_timestamp_us is not None
            gap_us = frame_start_us - self._segment_end_timestamp_us
            if gap_us > self._continuity_tolerance_us:
                LOGGER.debug(
                    "resetting audio encoder segment gap_ms=%.1f previous_end_ms=%.1f next_audio_ms=%.1f",
                    gap_us / 1_000,
                    self._segment_end_timestamp_us / 1_000,
                    frame_start_us / 1_000,
                )
                encoded.extend(self._finish_segment())
                self._reset_segment()
                self._start_segment(frame_start_us)

        frame.pts = self._next_local_sample
        frame.time_base = Fraction(1, self.sample_rate)
        self.fifo.write(frame)
        self._next_local_sample += frame.samples

        assert self._segment_base_timestamp_us is not None
        self._segment_end_timestamp_us = (
            self._segment_base_timestamp_us
            + self._next_local_sample * 1_000_000 // self.sample_rate
        )

        encoded.extend(self._drain_fifo(partial=False))
        return encoded

    def _start_segment(self, timestamp_us: int) -> None:
        self._segment_base_timestamp_us = timestamp_us
        self._segment_end_timestamp_us = timestamp_us
        self._next_local_sample = 0

    def _reset_segment(self) -> None:
        self.context = self._create_context()
        self.fifo = AudioFifo()
        self._queued_timestamps.clear()
        self._segment_base_timestamp_us = None
        self._segment_end_timestamp_us = None
        self._next_local_sample = 0

    def _finish_segment(self) -> list[EncodedFrame]:
        encoded = self._drain_fifo(partial=True)
        encoded.extend(self._packets_to_frames(self.context.encode(None)))
        self._queued_timestamps.clear()
        return encoded

    def _drain_fifo(self, *, partial: bool) -> list[EncodedFrame]:
        encoded: list[EncodedFrame] = []
        while self.fifo.samples >= self.frame_size:
            frame = self.fifo.read(self.frame_size)
            encoded.extend(self._encode_frame(frame))

        if partial and self.fifo.samples:
            frame = self.fifo.read(self.fifo.samples, partial=True)
            if frame is not None:
                encoded.extend(self._encode_frame(frame))

        return encoded

    def _encode_frame(self, frame: AudioFrame) -> list[EncodedFrame]:
        timestamp_us = self._frame_timestamp_us(frame)
        self._queued_timestamps.append(timestamp_us)
        return self._packets_to_frames(self.context.encode(frame))

    def _packets_to_frames(self, packets) -> list[EncodedFrame]:
        encoded: list[EncodedFrame] = []
        for packet in packets:
            timestamp_us = (
                self._queued_timestamps.popleft()
                if self._queued_timestamps
                else self._fallback_timestamp_us()
            )
            encoded.append(
                EncodedFrame(payload=bytes(packet), timestamp_us=timestamp_us)
            )
        return encoded

    def _frame_timestamp_us(self, frame: AudioFrame) -> int:
        if self._segment_base_timestamp_us is None:
            return frame_timestamp_us(frame)
        local_sample = int(frame.pts or 0)
        return (
            self._segment_base_timestamp_us
            + local_sample * 1_000_000 // self.sample_rate
        )

    def _fallback_timestamp_us(self) -> int:
        if self._segment_end_timestamp_us is not None:
            return self._segment_end_timestamp_us
        if self._segment_base_timestamp_us is not None:
            return self._segment_base_timestamp_us
        return 0


def _log_timestamp_delta(
    stage: str,
    timestamp_us: int,
    last_timestamp_us: int | None,
    *,
    payload_bytes: int,
) -> None:
    pass
    # if LOGGER.isEnabledFor(logging.DEBUG):
    #     delta_us = (
    #         timestamp_us - last_timestamp_us if last_timestamp_us is not None else None
    #     )
    #     LOGGER.debug(
    #         "audio timing stage=%s timestamp_ms=%.1f delta_ms=%s bytes=%d",
    #         stage,
    #         timestamp_us / 1_000,
    #         _format_ms(delta_us),
    #         payload_bytes,
    #     )


def _log_pcm_chunk_interval(
    stage: str, chunk: PcmChunk, last_end_us: int | None
) -> None:
    duration_us = chunk.samples * 1_000_000 // chunk.format.sample_rate
    _log_audio_interval(
        stage,
        timestamp_us=chunk.timestamp_us,
        duration_us=duration_us,
        last_end_us=last_end_us,
        samples=chunk.samples,
        sample_rate=chunk.format.sample_rate,
        layout=chunk.format.layout,
        payload_bytes=len(chunk.data),
    )


def _log_audio_frame_interval(
    stage: str, frame: AudioFrame, last_end_us: int | None
) -> None:
    sample_rate = int(frame.sample_rate or 0)
    duration_us = frame.samples * 1_000_000 // sample_rate if sample_rate else 0
    _log_audio_interval(
        stage,
        timestamp_us=frame_timestamp_us(frame),
        duration_us=duration_us,
        last_end_us=last_end_us,
        samples=frame.samples,
        sample_rate=sample_rate,
        layout=frame.layout.name,
        payload_bytes=_audio_frame_payload_bytes(frame)
        if LOGGER.isEnabledFor(logging.DEBUG)
        else 0,
    )


def _log_audio_interval(
    stage: str,
    *,
    timestamp_us: int,
    duration_us: int,
    last_end_us: int | None,
    samples: int,
    sample_rate: int,
    layout: str,
    payload_bytes: int,
) -> None:
    end_us = timestamp_us + duration_us
    if LOGGER.isEnabledFor(logging.DEBUG):
        gap_us = timestamp_us - last_end_us if last_end_us is not None else None
        LOGGER.debug(
            (
                "audio timing stage=%s timestamp_ms=%.1f duration_ms=%.1f gap_ms=%s "
                "end_ms=%.1f samples=%d sample_rate=%d layout=%s bytes=%d"
            ),
            stage,
            timestamp_us / 1_000,
            duration_us / 1_000,
            _format_ms(gap_us),
            end_us / 1_000,
            samples,
            sample_rate,
            layout,
            payload_bytes,
        )


def _pcm_chunk_end_us(chunk: PcmChunk) -> int:
    duration_us = chunk.samples * 1_000_000 // chunk.format.sample_rate
    return chunk.timestamp_us + duration_us


def _elapsed_us(start_ns: int) -> int:
    return (time.perf_counter_ns() - start_ns) // 1_000


def _audio_frame_end_us(frame: AudioFrame) -> int:
    timestamp_us = frame_timestamp_us(frame)
    sample_rate = int(frame.sample_rate or 0)
    if not sample_rate:
        return timestamp_us
    duration_us = frame.samples * 1_000_000 // sample_rate
    return timestamp_us + duration_us


def _format_ms(value_us: int | None) -> str:
    if value_us is None:
        return "n/a"
    return f"{value_us / 1_000:.1f}"


def _audio_frame_payload_bytes(frame: AudioFrame) -> int:
    total = 0
    for plane in frame.planes:
        buffer_size = getattr(plane, "buffer_size", None)
        total += int(buffer_size) if buffer_size is not None else len(bytes(plane))
    return total


def pcm_chunk_to_frame(chunk: PcmChunk) -> AudioFrame:
    samples = chunk.samples
    frame = av.AudioFrame(format="s16", layout=chunk.format.layout, samples=samples)
    frame.sample_rate = chunk.format.sample_rate
    frame.time_base = Fraction(1, chunk.format.sample_rate)
    frame.pts = chunk.timestamp_us * chunk.format.sample_rate // 1_000_000
    frame.planes[0].update(chunk.data)
    return frame


def pcm_frame_to_bytes(frame: AudioFrame, expected_format: PcmFormat) -> bytes:
    if frame.format.name != "s16":
        raise ValueError(f"expected s16 PCM frame, got {frame.format.name}")
    if frame.layout.name != expected_format.layout:
        raise ValueError(
            f"expected {expected_format.layout} PCM frame, got {frame.layout.name}"
        )
    if int(frame.sample_rate) != expected_format.sample_rate:
        raise ValueError(
            f"expected {expected_format.sample_rate} Hz PCM frame, got {frame.sample_rate}"
        )

    expected_bytes = frame.samples * expected_format.bytes_per_frame
    return bytes(frame.planes[0])[:expected_bytes]


def frame_timestamp_us(frame: AudioFrame) -> int:
    if frame.pts is None or frame.time_base is None:
        return 0
    return int(frame.pts * frame.time_base * 1_000_000)


def layout_name(channels: int) -> str:
    if channels == 1:
        return "mono"
    if channels == 2:
        return "stereo"
    raise ValueError(f"unsupported channel count: {channels}")


def encoder_name(family: str) -> str:
    if family == "opus":
        return "libopus"
    if family == "aac":
        return "aac"
    raise ValueError(f"unsupported audio codec: {family}")


def encoder_sample_format(family: str) -> str:
    if family == "opus":
        return "s16"
    if family == "aac":
        return "fltp"
    raise ValueError(f"unsupported audio codec: {family}")


def default_bit_rate(family: str, channels: int) -> int:
    if family == "opus":
        return 64_000 * channels
    if family == "aac":
        return 96_000 * channels
    raise ValueError(f"unsupported audio codec: {family}")
