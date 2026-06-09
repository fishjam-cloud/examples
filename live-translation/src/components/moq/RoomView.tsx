import type * as Watch from '@moq/watch';
import { Loader2 } from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useWakeLock } from '@/hooks/useWakeLock';

import { BrandHeader } from './BrandHeader';
import { CallToolbar } from './CallToolbar';
import { getPersistedMoqQualityPreference } from './quality';
import type { MoqConnectionSignal, MoqConnectionStatus, MoqQualityPreference, MoqTile } from './types';
import { useSyncedPlayback } from './useSyncedPlayback';
import { getPersistedTranslationLatencyMs, getPersistedVideoLatencyMs, getTileId } from './utils';
import { VideoTile } from './VideoTile';

type Props = {
  roomName?: string;
  connection: MoqConnectionSignal;
  connectionStatus: MoqConnectionStatus;
  tiles: MoqTile[];
  // Disconnect the stream and return to the pre-play state (the Play button).
  onDisconnect: () => void;
  // Optional overlay rendered on top of the player area only (e.g. a Play gate).
  playOverlay?: ReactNode;
  // True once playback has been requested: show a loading spinner while connecting and
  // buffering, instead of a blank frame.
  pending?: boolean;
  // True when the stream is not available (it ended, or never existed for this link).
  unavailable?: boolean;
  // Navigate to the main page to start an own stream (shown when `unavailable`).
  onStartOwn?: () => void;
};

export const RoomView = ({
  connection,
  tiles,
  onDisconnect,
  playOverlay,
  pending,
  unavailable,
  onStartOwn,
}: Props) => {
  useWakeLock();

  const [qualityPreference] = useState<MoqQualityPreference>(getPersistedMoqQualityPreference);
  const [manualQualityOverrides, setManualQualityOverrides] = useState<Record<string, string>>({});
  const [selectedTranslations, setSelectedTranslations] = useState<Record<string, string>>({});
  const [translationLatencyMs] = useState<number>(getPersistedTranslationLatencyMs);
  const [videoLatencyMs] = useState<number>(getPersistedVideoLatencyMs);

  // Single-stream viewer: render the one remote stream in a fixed-size player frame.
  const primaryTile = tiles[0];
  const primaryTileId = primaryTile ? getTileId(primaryTile) : undefined;

  // The translation audio selected for the primary tile, if any.
  const primaryTranslationPath = useMemo(() => {
    if (!primaryTile || primaryTile.local || !primaryTileId) {
      return undefined;
    }

    const selectedKey = selectedTranslations[primaryTileId];
    return selectedKey ? primaryTile.translations?.find((entry) => entry.key === selectedKey)?.path : undefined;
  }, [primaryTile, primaryTileId, selectedTranslations]);

  // One synced video + audio pipeline for the primary tile. When a translation is
  // selected the original video is delayed to line up with the translated audio
  // (audio-clocked sync); otherwise it plays the original audio in real time.
  const syncedPlayback = useSyncedPlayback(
    primaryTile,
    connection,
    primaryTranslationPath,
    videoLatencyMs,
    translationLatencyMs,
  );

  useEffect(() => {
    const activeTileIds = new Set(tiles.map(getTileId));

    setManualQualityOverrides((current) => {
      const nextEntries = Object.entries(current).filter(([tileId]) => activeTileIds.has(tileId));

      return nextEntries.length === Object.keys(current).length ? current : Object.fromEntries(nextEntries);
    });
  }, [tiles]);

  // Drop translation selections whose tile left or whose option is no longer announced.
  useEffect(() => {
    const availableByTile = new Map(tiles.map((tile) => [getTileId(tile), tile.translations ?? []]));

    setSelectedTranslations((current) => {
      const nextEntries = Object.entries(current).filter(([tileId, key]) =>
        availableByTile.get(tileId)?.some((option) => option.key === key),
      );

      return nextEntries.length === Object.keys(current).length ? current : Object.fromEntries(nextEntries);
    });
  }, [tiles]);

  const setTileTranslation = (tileId: string, translationKey: string | undefined) => {
    setSelectedTranslations((current) => {
      const rest = { ...current };
      delete rest[tileId];

      return translationKey ? { ...rest, [tileId]: translationKey } : rest;
    });
  };

  const setManualQualityOverride = (tileId: string, rendition: string | undefined) => {
    setManualQualityOverrides((current) => {
      const rest = { ...current };
      delete rest[tileId];

      return rendition ? { ...rest, [tileId]: rendition } : rest;
    });
  };

  return (
    <div className="flex w-full flex-col justify-between">
      <section className="flex flex-col items-center px-4 pb-4 pt-8 md:pt-16">
        <BrandHeader />
      </section>

      <section
        id="moq-room"
        className={cn('relative flex max-h-[calc(100%-96px-64px)] w-full justify-between flex-grow flex-nowrap px-8')}>
        {playOverlay}

        {/* Fixed-size player frame. The video tile fills the exact same box as the
            pre-connect placeholder, so the player size doesn't change on Play. */}
        <div className="flex w-full items-center justify-center">
          <div className="aspect-video w-full max-w-5xl overflow-hidden rounded-lg">
            {primaryTile && primaryTileId ? (
              <VideoTile
                tile={primaryTile}
                remoteBackend={syncedPlayback as unknown as Watch.MultiBackend | null}
                qualityPreference={qualityPreference}
                manualQualityOverride={manualQualityOverrides[primaryTileId]}
                useSharedRemoteBackend={!primaryTile.local}
                style={{ width: '100%', height: '100%' }}
                selectedTranslationKey={selectedTranslations[primaryTileId]}
                onTranslationChange={(translationKey) => setTileTranslation(primaryTileId, translationKey)}
                onManualQualityChange={(rendition) => setManualQualityOverride(primaryTileId, rendition)}
              />
            ) : unavailable ? (
              <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-[#FCF6E7]/70 px-6 text-center backdrop-blur-sm">
                <div className="flex flex-col gap-1">
                  <p className="text-lg font-semibold">This stream isn't available</p>
                  <p className="text-sm text-stone-500">It may have ended or hasn't started yet.</p>
                </div>
                <Button onClick={onStartOwn}>Start your own one!</Button>
              </div>
            ) : pending ? (
              <div className="flex h-full w-full items-center justify-center bg-[#FCF6E7]/70 backdrop-blur-sm">
                <Loader2 className="animate-spin text-stone-400" size={48} />
              </div>
            ) : (
              <div className="h-full w-full bg-stone-200" />
            )}
          </div>
        </div>
      </section>

      <CallToolbar onDisconnect={onDisconnect} />
    </div>
  );
};
