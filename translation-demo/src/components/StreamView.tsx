import { Loader2 } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';

import { BrandHeader } from '@/components/BrandHeader';
import { StreamToolbar } from '@/components/StreamToolbar';
import { Button } from '@/components/ui/button';
import { useWakeLock } from '@/hooks/useWakeLock';
import { cn } from '@/utils/cn';

import type { MoqConnectionSignal, MoqStream } from '@/utils/types';
import { useSignalValue } from '@/hooks/useSignalValue';
import { ORIGINAL_AUDIO_KEY, useSyncedStreamPlayer } from '@/hooks/useSyncedStreamPlayer';
import { useTranslationTranscription } from '@/hooks/useTranslationTranscription';
import { getTranslationTargetId } from '@/utils/translation';
import { StreamPlayer } from '@/components/StreamPlayer';

type Props = {
  connection: MoqConnectionSignal;
  stream?: MoqStream;
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

export const StreamView = ({
  connection,
  stream,
  onDisconnect,
  playOverlay,
  pending,
  unavailable,
  onStartOwn,
}: Props) => {
  useWakeLock();

  const [selectedTranslationKey, setSelectedTranslationKey] = useState<string | undefined>(undefined);
  const [captionsEnabled, setCaptionsEnabled] = useState(false);

  const selectedTranslation = selectedTranslationKey
    ? stream?.translations?.find((option) => option.key === selectedTranslationKey)
    : undefined;

  // Shared-clock player: original video + selectable audio (original or a translation), all
  // delayed and aligned by timestamp.
  const player = useSyncedStreamPlayer(stream, connection);

  // Drive the audible audio track from the selection. The player keeps the previous track
  // playing until the new one has warmed up (requesting a not-yet-produced language first), so
  // this never freezes the picture.
  useEffect(() => {
    player?.selectAudio(selectedTranslation);
  }, [player, selectedTranslation]);

  // The player's audible/pending track, mirrored from its signals for the UI and captions.
  const audibleKey = useSignalValue(player?.audibleKey, (key) => key ?? ORIGINAL_AUDIO_KEY);
  const pendingKey = useSignalValue(player?.pendingKey);

  // Captions follow the track actually being heard (which lags the selection during a warm-up),
  // so they stay in sync with the audio. The player times every track to the video play-head, so
  // the shared player clock is the right reference for revealing caption segments.
  const audibleTranslation =
    audibleKey === ORIGINAL_AUDIO_KEY ? undefined : stream?.translations?.find((option) => option.key === audibleKey);
  const { caption, unavailableTarget } = useTranslationTranscription(
    captionsEnabled ? audibleTranslation : undefined,
    player?.sync,
  );

  // The heard translation has no transcription track: turn captions off and keep the CC toggle
  // disabled while it stays selected.
  const audibleTarget = audibleTranslation
    ? getTranslationTargetId(audibleTranslation.path, audibleTranslation.trackName)
    : undefined;
  const captionsUnavailable = !!audibleTranslation && unavailableTarget === audibleTarget;
  useEffect(() => {
    if (captionsUnavailable) {
      setCaptionsEnabled(false);
    }
  }, [captionsUnavailable]);

  // Drop the selection if its option is no longer announced (or the stream left).
  useEffect(() => {
    if (selectedTranslationKey && !stream?.translations?.some((option) => option.key === selectedTranslationKey)) {
      setSelectedTranslationKey(undefined);
      setCaptionsEnabled(false);
    }
  }, [stream, selectedTranslationKey]);

  const handleTranslationChange = (translationKey: string | undefined) => {
    setSelectedTranslationKey(translationKey);

    // Captions follow the chosen language; turning the translation off turns them off too.
    if (!translationKey) {
      setCaptionsEnabled(false);
    }
  };

  return (
    <div className="flex w-full flex-col justify-between">
      <section className="flex flex-col items-center px-4 pb-4 pt-8 md:pt-16">
        <BrandHeader />
      </section>

      <section
        id="moq-stream"
        className={cn('relative flex max-h-[calc(100%-96px-64px)] w-full justify-between flex-grow flex-nowrap px-8')}>
        {playOverlay}

        {/* Fixed-size player frame. The stream player fills the exact same box as the
            pre-connect placeholder, so the player size doesn't change on Play. */}
        <div className="flex w-full items-center justify-center">
          <div className="aspect-video w-full max-w-5xl overflow-hidden rounded-lg">
            {stream ? (
              <StreamPlayer
                stream={stream}
                player={player}
                style={{ width: '100%', height: '100%' }}
                selectedTranslationKey={selectedTranslationKey}
                onTranslationChange={handleTranslationChange}
                captionsEnabled={captionsEnabled}
                captionsUnavailable={captionsUnavailable}
                onCaptionsToggle={setCaptionsEnabled}
                captionText={caption}
                audioLoading={!!pendingKey}
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

      <StreamToolbar onDisconnect={onDisconnect} />
    </div>
  );
};
