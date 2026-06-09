import * as Watch from '@moq/watch';
import { Languages, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

import {
  formatRenditionLabel,
  getSortedRenditionNames,
  selectManualOverrideRendition,
  selectRenditionName,
} from './quality';
import type { MoqTile } from './types';
import type { MoqQualityPreference } from './types';
import { VideoSurface } from './VideoSurface';

const ORIGINAL_AUDIO_VALUE = 'original';

type Props = {
  tile: MoqTile;
  onManualQualityChange?: (rendition: string | undefined) => void;
  onTranslationChange?: (translationKey: string | undefined) => void;
  selectedTranslationKey?: string;
  remoteBackend?: Watch.MultiBackend | null;
  qualityPreference: MoqQualityPreference;
  manualQualityOverride?: string;
  useSharedRemoteBackend?: boolean;
  style?: React.CSSProperties;
  isPinned?: boolean;
};

type RenditionConfig = {
  codedWidth?: number;
  codedHeight?: number;
  bitrate?: number;
};

export const VideoTile = ({
  tile,
  style,
  onManualQualityChange,
  onTranslationChange,
  selectedTranslationKey,
  remoteBackend,
  qualityPreference,
  manualQualityOverride,
  useSharedRemoteBackend = false,
  isPinned,
}: Props) => {
  const [localBackend, setLocalBackend] = useState<Watch.MultiBackend | null>(null);
  const [availableRenditions, setAvailableRenditions] = useState<Record<string, RenditionConfig>>({});
  const [selectedRendition, setSelectedRendition] = useState<string | undefined>(undefined);
  const backend = useSharedRemoteBackend ? (remoteBackend ?? null) : (remoteBackend ?? localBackend);
  const sortedRenditions = getSortedRenditionNames(availableRenditions, 'descending');
  const translations = tile.translations ?? [];
  const selectedTranslation = selectedTranslationKey
    ? translations.find((option) => option.key === selectedTranslationKey)
    : undefined;
  const [hasRenderedFrame, setHasRenderedFrame] = useState<boolean>(() => {
    if (tile.local) {
      return !!tile.stream;
    }

    return remoteBackend ? remoteBackend.video.timestamp.peek() !== undefined : false;
  });

  useEffect(() => {
    if (!backend) {
      setAvailableRenditions({});
      setSelectedRendition(undefined);
      setHasRenderedFrame(tile.local ? !!tile.stream : false);
      return;
    }

    const syncRenditions = () => {
      const nextRenditions = backend.video.source.available.peek();
      const target = backend.video.source.target.peek();
      const track = backend.video.source.track.peek();

      setAvailableRenditions(nextRenditions);
      setSelectedRendition(track ?? target?.name ?? Object.keys(nextRenditions)[0]);
    };

    syncRenditions();

    const disposeAvailable = backend.video.source.available.subscribe(syncRenditions);
    const disposeTarget = backend.video.source.target.subscribe(syncRenditions);
    const disposeTrack = backend.video.source.track.subscribe(syncRenditions);

    return () => {
      disposeAvailable();
      disposeTarget();
      disposeTrack();
    };
  }, [backend, tile.local, tile.stream]);

  useEffect(() => {
    if (!backend || tile.local) {
      return;
    }

    const syncRenderedFrame = () => {
      setHasRenderedFrame(backend.video.timestamp.peek() !== undefined);
    };

    syncRenderedFrame();

    const disposeTimestamp = backend.video.timestamp.subscribe(syncRenderedFrame);

    return () => {
      disposeTimestamp();
    };
  }, [backend, tile.local]);

  useEffect(() => {
    if (tile.local) {
      setHasRenderedFrame(!!tile.stream);
      return;
    }

    if (!tile.hasVideo) {
      setHasRenderedFrame(false);
    }
  }, [tile.hasVideo, tile.local, tile.stream]);

  useEffect(() => {
    if (!backend || tile.local || Object.keys(availableRenditions).length === 0) {
      return;
    }

    const targetRendition = manualQualityOverride
      ? selectManualOverrideRendition(availableRenditions, manualQualityOverride)
      : selectRenditionName(availableRenditions, qualityPreference, style);

    if (!targetRendition || backend.video.source.target.peek()?.name === targetRendition) {
      return;
    }

    backend.video.source.target.set({ name: targetRendition });
  }, [availableRenditions, backend, manualQualityOverride, qualityPreference, style, tile.local]);

  const isLocalCameraTile = tile.local && tile.type !== 'screenshare';
  const isScreenshareTile = tile.type === 'screenshare';
  const shouldRenderElement = !!tile.stream || !!tile.broadcast;
  const shouldShowVideo = tile.local ? !!tile.stream : tile.hasVideo && hasRenderedFrame;
  const isTileWithoutVideo = !shouldShowVideo;
  const displayedName = tile.local
    ? isScreenshareTile
      ? 'You (Screen)'
      : isPinned
        ? `${tile.name ?? 'You'} (You)`
        : 'You'
    : (tile.name ?? 'Remote peer');

  return (
    <div
      className={cn(
        'relative flex items-center justify-center overflow-hidden rounded-lg bg-stone-200',
        isTileWithoutVideo && "bg-[url('./avatar.svg')] bg-center bg-no-repeat bg-[length:33%]",
        isScreenshareTile && 'bg-black',
      )}
      style={style}>
      {shouldRenderElement && (
        <VideoSurface
          className={cn('z-20 h-full max-w-full rounded-md object-cover', {
            'scale-x-[-1]': isLocalCameraTile,
            'invisible': !shouldShowVideo,
          })}
          muted={tile.local}
          stream={tile.stream}
          broadcast={tile.broadcast}
          showVideo={shouldShowVideo}
          backend={remoteBackend}
          disableLocalBackend={useSharedRemoteBackend}
          onBackendChange={useSharedRemoteBackend || remoteBackend ? undefined : setLocalBackend}
          data-peer-id={tile.peerId}
        />
      )}

      {!tile.local && tile.hasVideo && !hasRenderedFrame && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#FCF6E7]/70 backdrop-blur-sm">
          <Loader2 className="animate-spin text-stone-400" size={48} />
        </div>
      )}

      {displayedName && (
        <Badge className="text-sm absolute bottom-1 left-1 z-30 px-4 select-none">{displayedName}</Badge>
      )}

      {!tile.local && shouldShowVideo && (sortedRenditions.length > 1 || translations.length > 0) && (
        <div className="absolute top-1 left-1 z-30 flex flex-col items-start gap-1">
          {translations.length > 0 && (
            <Select
              onValueChange={(value) =>
                onTranslationChange?.(value === ORIGINAL_AUDIO_VALUE ? undefined : value)
              }
              value={selectedTranslation?.key ?? ORIGINAL_AUDIO_VALUE}>
              <SelectTrigger className="h-7 w-auto min-w-16 border-0 bg-black/50 px-2 text-xs font-semibold text-white shadow-none hover:bg-black/70 focus:ring-white [&>svg]:ml-1 [&>svg]:text-white [&>svg]:opacity-100">
                <SelectValue>
                  <span className="flex items-center gap-1">
                    <Languages size={14} />
                    {selectedTranslation?.label ?? 'Original'}
                  </span>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ORIGINAL_AUDIO_VALUE}>Original</SelectItem>
                {translations.map((option) => (
                  <SelectItem key={option.key} value={option.key}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {sortedRenditions.length > 1 && (
            <Select
              onValueChange={(value) => onManualQualityChange?.(value === 'global' ? undefined : value)}
              value={manualQualityOverride ?? 'global'}>
              <SelectTrigger className="h-7 w-auto min-w-16 border-0 bg-black/50 px-2 text-xs font-semibold text-white shadow-none hover:bg-black/70 focus:ring-white [&>svg]:ml-1 [&>svg]:text-white [&>svg]:opacity-100">
                <SelectValue>
                  {formatRenditionLabel(selectedRendition)}
                  {manualQualityOverride ? ' Manual' : ''}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="global">Follow global</SelectItem>
                {sortedRenditions.map((rendition) => (
                  <SelectItem key={rendition} value={rendition}>
                    {formatRenditionLabel(rendition)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}
    </div>
  );
};
