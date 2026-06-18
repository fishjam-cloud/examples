import { Captions, Loader2 } from 'lucide-react';

import { TranslationMenu } from '@/components/TranslationMenu';
import { VideoSurface } from '@/components/VideoSurface';
import { useSignalValue } from '@/hooks/useSignalValue';
import type { SyncedStreamPlayer } from '@/hooks/useSyncedStreamPlayer';
import { cn } from '@/utils/cn';
import type { MoqStream, TranslationOption } from '@/utils/types';

const EMPTY_TRANSLATIONS: TranslationOption[] = [];

type Props = {
  stream: MoqStream;
  onTranslationChange?: (translationKey: string | undefined) => void;
  selectedTranslationKey?: string;
  captionsEnabled?: boolean;
  // The selected translation has no transcription track; the CC toggle is disabled.
  captionsUnavailable?: boolean;
  onCaptionsToggle?: (enabled: boolean) => void;
  captionText?: string;
  player?: SyncedStreamPlayer | null;
  // A newly selected language is warming up; the previous audio still plays until it's ready.
  audioLoading?: boolean;
  style?: React.CSSProperties;
};

export const StreamPlayer = ({
  stream,
  style,
  onTranslationChange,
  selectedTranslationKey,
  captionsEnabled,
  captionsUnavailable,
  onCaptionsToggle,
  captionText,
  player,
  audioLoading,
}: Props) => {
  const translations = stream.translations ?? EMPTY_TRANSLATIONS;
  const selectedTranslation = selectedTranslationKey
    ? translations.find((option) => option.key === selectedTranslationKey)
    : undefined;

  // True once the first video frame has decoded. Collapsed to a boolean so the per-frame
  // timestamp updates only re-render when it actually flips. `shouldShowVideo` also gates on
  // `stream.hasVideo`, so a stream without video never shows the surface.
  const hasRenderedFrame = useSignalValue(player?.videoTimestamp, (timestamp) => timestamp !== undefined);

  const shouldShowVideo = stream.hasVideo && hasRenderedFrame;

  return (
    <div className="relative flex items-center justify-center overflow-hidden rounded-lg bg-stone-200" style={style}>
      {player && (
        <VideoSurface
          className={cn('z-20 h-full max-w-full rounded-md object-cover', {
            invisible: !shouldShowVideo,
          })}
          showVideo={shouldShowVideo}
          player={player}
        />
      )}

      {stream.hasVideo && !hasRenderedFrame && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#FCF6E7]/70 backdrop-blur-sm">
          <Loader2 className="animate-spin text-stone-400" size={48} />
        </div>
      )}

      {captionText && (
        <div className="absolute bottom-10 left-1/2 z-30 max-w-[85%] -translate-x-1/2 rounded-md bg-black/60 px-3 py-1 text-center text-sm font-medium text-white select-none">
          {captionText}
        </div>
      )}

      {shouldShowVideo && translations.length > 0 && (
        <div className="absolute top-1 left-1 z-30 flex flex-col items-start gap-1">
          <TranslationMenu
            translations={translations}
            selectedKey={selectedTranslationKey}
            onSelect={onTranslationChange ?? (() => {})}
            audioLoading={audioLoading}
          />

          {selectedTranslation && onCaptionsToggle && (
            <button
              type="button"
              disabled={captionsUnavailable}
              onClick={() => onCaptionsToggle(!captionsEnabled)}
              title={
                captionsUnavailable
                  ? 'Live transcription is not available for this stream'
                  : captionsEnabled
                    ? 'Hide live transcription'
                    : 'Show live transcription'
              }
              className={cn(
                'flex h-7 items-center gap-1 rounded-md bg-black/50 px-2 text-xs font-semibold text-white hover:bg-black/70',
                !captionsEnabled && 'text-white/60',
                captionsUnavailable && 'cursor-not-allowed opacity-50 hover:bg-black/50',
              )}>
              <Captions size={14} />
              CC
            </button>
          )}
        </div>
      )}
    </div>
  );
};
