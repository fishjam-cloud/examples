import { Captions, Check, Languages, Loader2, Plus, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { cn } from '@/utils';

import type { MoqStream, TranslationOption } from './types';
import type { SyncedStreamPlayer } from './useSyncedStreamPlayer';
import { formatProviderLabel } from './utils';
import { VideoSurface } from './VideoSurface';

const EMPTY_TRANSLATIONS: TranslationOption[] = [];

type TranslationMenuPosition = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

type TranslationMenuItemProps = {
  option: TranslationOption;
  selected: boolean;
  onSelect: () => void;
};

const TranslationMenuItem = ({ option, selected, onSelect }: TranslationMenuItemProps) => {
  const Icon = option.status === 'active' ? Languages : Plus;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-none transition hover:bg-stone-100 focus:bg-stone-100',
        selected && 'bg-stone-100',
      )}>
      <Icon size={14} className="shrink-0 text-stone-500" />
      <span className="min-w-0 flex-1 truncate">{option.label}</span>
      <span className="shrink-0 text-[10px] font-semibold uppercase text-stone-500">
        {formatProviderLabel(option.provider)}
      </span>
      {selected && <Check size={14} className="shrink-0 text-stone-900" />}
    </button>
  );
};

type Props = {
  stream: MoqStream;
  onTranslationChange?: (translationKey: string | undefined) => void;
  selectedTranslationKey?: string;
  captionsEnabled?: boolean;
  // The selected translation has no transcription track; the CC toggle is disabled.
  captionsUnavailable?: boolean;
  onCaptionsToggle?: (enabled: boolean) => void;
  // Latest live transcription text for the selected translation.
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
  const activeTranslations = useMemo(() => translations.filter((option) => option.status === 'active'), [translations]);
  const requestableTranslations = useMemo(
    () => translations.filter((option) => option.status === 'requestable'),
    [translations],
  );
  const [translationMenuOpen, setTranslationMenuOpen] = useState(false);
  const [languageQuery, setLanguageQuery] = useState('');
  const translationTriggerRef = useRef<HTMLButtonElement | null>(null);
  const translationPanelRef = useRef<HTMLDivElement | null>(null);
  const [translationMenuPosition, setTranslationMenuPosition] = useState<TranslationMenuPosition | null>(null);
  const selectedTranslationPending = selectedTranslation?.status === 'requestable';
  const filteredRequestableTranslations = useMemo(() => {
    const needle = languageQuery.trim().toLowerCase();

    if (!needle) {
      return requestableTranslations;
    }

    return requestableTranslations.filter(
      (option) =>
        option.label.toLowerCase().includes(needle) ||
        option.language.toLowerCase().includes(needle) ||
        formatProviderLabel(option.provider).toLowerCase().includes(needle),
    );
  }, [languageQuery, requestableTranslations]);
  const [hasRenderedFrame, setHasRenderedFrame] = useState<boolean>(() =>
    player ? player.videoTimestamp.peek() !== undefined : false,
  );

  useEffect(() => {
    if (!player) {
      setHasRenderedFrame(false);
      return;
    }

    const syncRenderedFrame = () => {
      setHasRenderedFrame(player.videoTimestamp.peek() !== undefined);
    };

    syncRenderedFrame();

    const disposeTimestamp = player.videoTimestamp.subscribe(syncRenderedFrame);

    return () => {
      disposeTimestamp();
    };
  }, [player]);

  useEffect(() => {
    if (!stream.hasVideo) {
      setHasRenderedFrame(false);
    }
  }, [stream.hasVideo]);

  useEffect(() => {
    if (!translationMenuOpen) {
      return;
    }

    const closeOnOutsidePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;

      if (translationTriggerRef.current?.contains(target) || translationPanelRef.current?.contains(target)) {
        return;
      }

      setTranslationMenuOpen(false);
    };

    window.addEventListener('pointerdown', closeOnOutsidePointerDown);

    return () => {
      window.removeEventListener('pointerdown', closeOnOutsidePointerDown);
    };
  }, [translationMenuOpen]);

  useEffect(() => {
    if (!translationMenuOpen) {
      setTranslationMenuPosition(null);
      return;
    }

    const updatePosition = () => {
      const rect = translationTriggerRef.current?.getBoundingClientRect();

      if (!rect) {
        setTranslationMenuPosition(null);
        return;
      }

      const width = Math.min(288, window.innerWidth - 16);
      const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);

      const preferredTop = rect.bottom + 4;
      const availableBelow = window.innerHeight - preferredTop - 8;
      const openAbove = availableBelow < 220 && rect.top > availableBelow;
      const maxHeight = Math.max(160, openAbove ? rect.top - 8 : availableBelow);

      setTranslationMenuPosition({
        top: openAbove ? Math.max(8, rect.top - maxHeight - 4) : preferredTop,
        left,
        width,
        maxHeight,
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [translationMenuOpen]);

  useEffect(() => {
    if (translations.length > 0) {
      return;
    }

    setTranslationMenuOpen(false);
    setLanguageQuery('');
  }, [translations.length]);

  const selectTranslation = (translationKey: string | undefined) => {
    onTranslationChange?.(translationKey);
    setTranslationMenuOpen(false);
    setLanguageQuery('');
  };

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
          <div>
            <button
              ref={translationTriggerRef}
              type="button"
              onClick={() => setTranslationMenuOpen((open) => !open)}
              className="flex h-7 max-w-56 items-center gap-1 rounded-md bg-black/50 px-2 text-xs font-semibold text-white shadow-none outline-none hover:bg-black/70 focus:ring-2 focus:ring-white">
              <Languages size={14} className="shrink-0" />
              <span className="min-w-0 truncate">{selectedTranslation?.label ?? 'Original'}</span>
              {(selectedTranslationPending || audioLoading) && <Loader2 className="shrink-0 animate-spin" size={12} />}
            </button>

            {translationMenuOpen &&
              translationMenuPosition &&
              createPortal(
                <div
                  ref={translationPanelRef}
                  style={{
                    top: translationMenuPosition.top,
                    left: translationMenuPosition.left,
                    width: translationMenuPosition.width,
                    maxHeight: translationMenuPosition.maxHeight,
                  }}
                  className="fixed z-50 overflow-y-auto rounded-md border border-stone-200 bg-white p-2 text-stone-900 shadow-lg">
                  <button
                    type="button"
                    onClick={() => selectTranslation(undefined)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-none transition hover:bg-stone-100 focus:bg-stone-100',
                      !selectedTranslation && 'bg-stone-100',
                    )}>
                    <Languages size={14} className="shrink-0 text-stone-500" />
                    <span className="min-w-0 flex-1 truncate">Original</span>
                    {!selectedTranslation && <Check size={14} className="shrink-0 text-stone-900" />}
                  </button>

                  {activeTranslations.length > 0 && (
                    <div className="mt-2">
                      <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-stone-500">
                        Active
                      </p>
                      <div className="space-y-0.5">
                        {activeTranslations.map((option) => (
                          <TranslationMenuItem
                            key={option.key}
                            option={option}
                            selected={selectedTranslation?.key === option.key}
                            onSelect={() => selectTranslation(option.key)}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {requestableTranslations.length > 0 && (
                    <div className="mt-2 border-t border-stone-100 pt-2">
                      <div className="relative">
                        <Search
                          size={14}
                          className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-stone-400"
                        />
                        <input
                          value={languageQuery}
                          onChange={(event) => setLanguageQuery(event.target.value)}
                          className="h-8 w-full rounded-sm border border-stone-200 bg-white pl-7 pr-2 text-sm outline-none focus:border-stone-400"
                          placeholder="Search languages"
                        />
                      </div>

                      {selectedTranslationPending && (
                        <div className="mt-2 flex items-center gap-2 rounded-sm bg-amber-50 px-2 py-1.5 text-xs font-medium text-amber-800">
                          <Loader2 className="shrink-0 animate-spin" size={12} />
                          <span className="min-w-0 truncate">{selectedTranslation.label} waiting for catalog</span>
                        </div>
                      )}

                      <div className="mt-2 max-h-64 space-y-0.5 overflow-y-auto pr-1">
                        {filteredRequestableTranslations.length > 0 ? (
                          filteredRequestableTranslations.map((option) => (
                            <TranslationMenuItem
                              key={option.key}
                              option={option}
                              selected={selectedTranslation?.key === option.key}
                              onSelect={() => selectTranslation(option.key)}
                            />
                          ))
                        ) : (
                          <p className="px-2 py-2 text-sm text-stone-500">No matching languages</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>,
                document.body,
              )}
          </div>

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
