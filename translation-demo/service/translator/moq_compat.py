"""Compatibility helpers for MoQ Python APIs used by the service."""

from __future__ import annotations

try:
    import moq_net as moq
except ModuleNotFoundError:
    import moq


class _BroadcastDynamic:
    """Wrapper for dynamic broadcast requests.

    Older `moq-net` wrappers do not expose this API, while newer `moq-ffi`
    builds do. Prefer the `moq` wrapper when it is installed; this fallback
    only adapts an older wrapper around a newer raw FFI install.
    """

    def __init__(self, inner) -> None:
        self._inner = inner

    def __aiter__(self):
        return self

    async def __anext__(self):
        track = await self.requested_track()
        if track is None:
            raise StopAsyncIteration
        return track

    async def requested_track(self):
        track = await self._inner.requested_track()
        if track is None:
            return None
        return moq.TrackProducer(track)

    def cancel(self) -> None:
        self._inner.cancel()


def _dynamic(self):
    try:
        return _BroadcastDynamic(self._inner.dynamic())
    except AttributeError as exc:
        raise RuntimeError(
            "installed MoQ Python packages do not support dynamic broadcasts; "
            "install the newer `moq`/`moq-rs` wrapper with moq-ffi >= 0.2.16"
        ) from exc


def _publish_requested_media(self, track, format: str, init: bytes):
    publish_media_on_track = getattr(self, "publish_media_on_track", None)
    if publish_media_on_track is not None:
        return publish_media_on_track(track, format, init)

    try:
        publish = self._inner.publish_requested_media
    except AttributeError as exc:
        try:
            publish = self._inner.publish_media_on_track
        except AttributeError:
            raise RuntimeError(
                "installed MoQ Python packages do not support requested media tracks; "
                "install the newer `moq`/`moq-rs` wrapper with moq-ffi >= 0.2.16"
            ) from exc

    inner = publish(track._inner, format, init)
    return moq.MediaProducer(inner)


if not hasattr(moq.BroadcastProducer, "dynamic"):
    moq.BroadcastProducer.dynamic = _dynamic

if not hasattr(moq.BroadcastProducer, "publish_requested_media"):
    moq.BroadcastProducer.publish_requested_media = _publish_requested_media
