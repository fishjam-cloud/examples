"""Per-track translation session statistics."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field


SESSION_STATS_LOG_INTERVAL_SECONDS = 5.0


@dataclass
class MeasurementStats:
    count: int = 0
    total_us: int = 0
    latest_us: int | None = None
    max_us: int | None = None

    def record(self, value_us: int) -> None:
        self.count += 1
        self.total_us += value_us
        self.latest_us = value_us
        self.max_us = value_us if self.max_us is None else max(self.max_us, value_us)

    @property
    def average_us(self) -> float | None:
        if not self.count:
            return None
        return self.total_us / self.count


@dataclass
class SessionStats:
    decode_timing: MeasurementStats = field(default_factory=MeasurementStats)
    encode_timing: MeasurementStats = field(default_factory=MeasurementStats)
    model_latency: MeasurementStats = field(default_factory=MeasurementStats)
    first_response_latency_us: int | None = None
    latest_model_input_end_us: int | None = None
    latest_model_output_end_us: int | None = None

    def record_decode_timing(self, elapsed_us: int) -> None:
        self.decode_timing.record(max(0, elapsed_us))

    def record_encode_timing(self, elapsed_us: int) -> None:
        self.encode_timing.record(max(0, elapsed_us))

    def record_model_input_end(self, timestamp_us: int) -> None:
        self.latest_model_input_end_us = timestamp_us
        self._record_current_model_latency()

    def record_model_output_end(self, timestamp_us: int) -> None:
        self.latest_model_output_end_us = timestamp_us
        self._record_current_model_latency()

    def record_first_response_latency(self, elapsed_us: int) -> None:
        if self.first_response_latency_us is None:
            self.first_response_latency_us = max(0, elapsed_us)

    def log(
        self,
        logger: logging.Logger,
        *,
        provider_name: str,
        source_path: str,
        source_track: str,
        target_language: str,
    ) -> None:
        if not self.has_activity:
            return

        logger.debug(
            (
                "%s session stats model_latency_ms=%s model_latency_avg_ms=%s "
                "model_latency_max_ms=%s first_response_latency_ms=%s "
                "decode_count=%d decode_latest_ms=%s decode_avg_ms=%s decode_max_ms=%s "
                "encode_count=%d encode_latest_ms=%s encode_avg_ms=%s encode_max_ms=%s "
                "latest_input_end_ms=%s latest_output_end_ms=%s "
                "source=%s source_track=%s target_language=%s"
            ),
            provider_name,
            _format_ms(self.model_latency.latest_us),
            _format_ms(self.model_latency.average_us),
            _format_ms(self.model_latency.max_us),
            _format_ms(self.first_response_latency_us),
            self.decode_timing.count,
            _format_ms(self.decode_timing.latest_us),
            _format_ms(self.decode_timing.average_us),
            _format_ms(self.decode_timing.max_us),
            self.encode_timing.count,
            _format_ms(self.encode_timing.latest_us),
            _format_ms(self.encode_timing.average_us),
            _format_ms(self.encode_timing.max_us),
            _format_ms(self.latest_model_input_end_us),
            _format_ms(self.latest_model_output_end_us),
            source_path,
            source_track,
            target_language,
        )

    @property
    def has_activity(self) -> bool:
        return bool(
            self.decode_timing.count
            or self.encode_timing.count
            or self.model_latency.count
            or self.first_response_latency_us is not None
        )

    def _record_current_model_latency(self) -> None:
        if (
            self.latest_model_input_end_us is None
            or self.latest_model_output_end_us is None
        ):
            return

        self.model_latency.record(
            self.latest_model_input_end_us - self.latest_model_output_end_us
        )


def _format_ms(value_us: float | int | None) -> str:
    if value_us is None:
        return "n/a"
    return f"{value_us / 1_000:.1f}"
