import { useEffect, useState } from 'react';

import { SyncedPlayback, toLatency } from './syncedPlayback';
import type { MoqConnectionSignal, MoqTile } from './types';

/**
 * Drives one persistent {@link SyncedPlayback} for the given (remote) tile.
 *
 * The video pipeline is created once per video broadcast and kept alive; the
 * selected translation only switches the audio source and the clock mode, so
 * changing the audio language never reloads the picture.
 *
 * Returns `null` for local tiles or before the broadcast is available.
 */
export const useSyncedPlayback = (
  tile: MoqTile | undefined,
  connection: MoqConnectionSignal,
  translationPath: string | undefined,
  videoLatencyMs: number,
  translationLatencyMs: number,
): SyncedPlayback | null => {
  const [playback, setPlayback] = useState<SyncedPlayback | null>(null);

  const broadcast = tile && !tile.local ? tile.broadcast : undefined;

  // Create one synced playback per video broadcast. Latency / translation are
  // applied live in the effect below so this does not re-run on those changes.
  useEffect(() => {
    if (!broadcast) {
      setPlayback(null);
      return;
    }

    const instance = new SyncedPlayback({
      connection,
      videoBroadcast: broadcast,
      latency: toLatency(videoLatencyMs),
    });
    setPlayback(instance);

    return () => {
      instance.close();
      setPlayback(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [broadcast, connection]);

  // Switch audio source + clock mode + latency whenever the selection changes.
  useEffect(() => {
    if (!playback) {
      return;
    }

    playback.setTranslationPath(translationPath);
    playback.setLatencies(toLatency(videoLatencyMs), toLatency(translationLatencyMs));
  }, [playback, translationPath, translationLatencyMs, videoLatencyMs]);

  return playback;
};
