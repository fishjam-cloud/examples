import { Check, Languages, Loader2, Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/utils/cn';
import { formatProviderLabel } from '@/utils/translation';
import type { TranslationOption } from '@/utils/types';

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
      aria-pressed={selected}
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
  translations: TranslationOption[];
  selectedKey?: string;
  onSelect: (translationKey: string | undefined) => void;
  // A newly selected language is warming up; the previous audio still plays until it's ready.
  audioLoading?: boolean;
};

// Language picker for the stream: choose the original audio or one of the available/requestable
// translations. Built on the Radix Popover, which handles portalling, collision-aware
// positioning, outside-click/Escape dismissal, and focus management for us.
export const TranslationMenu = ({ translations, selectedKey, onSelect, audioLoading }: Props) => {
  const [open, setOpen] = useState(false);
  const [languageQuery, setLanguageQuery] = useState('');

  const selectedTranslation = selectedKey ? translations.find((option) => option.key === selectedKey) : undefined;
  const selectedTranslationPending = selectedTranslation?.status === 'requestable';

  const activeTranslations = useMemo(() => translations.filter((option) => option.status === 'active'), [translations]);
  const requestableTranslations = useMemo(
    () => translations.filter((option) => option.status === 'requestable'),
    [translations],
  );
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

  const select = (translationKey: string | undefined) => {
    onSelect(translationKey);
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // Reset the search each time the menu closes so it reopens clean.
        if (!next) {
          setLanguageQuery('');
        }
      }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-7 max-w-56 items-center gap-1 rounded-md bg-black/50 px-2 text-xs font-semibold text-white shadow-none outline-none hover:bg-black/70 focus:ring-2 focus:ring-white">
          <Languages size={14} className="shrink-0" />
          <span className="min-w-0 truncate">{selectedTranslation?.label ?? 'Original'}</span>
          {(selectedTranslationPending || audioLoading) && <Loader2 className="shrink-0 animate-spin" size={12} />}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        aria-label="Audio language"
        className="max-h-[var(--radix-popover-content-available-height)] overflow-y-auto text-stone-900">
        <button
          type="button"
          aria-pressed={!selectedTranslation}
          onClick={() => select(undefined)}
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
            <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-stone-500">Active</p>
            <div className="space-y-0.5">
              {activeTranslations.map((option) => (
                <TranslationMenuItem
                  key={option.key}
                  option={option}
                  selected={selectedTranslation?.key === option.key}
                  onSelect={() => select(option.key)}
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
                aria-label="Search languages"
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
                    onSelect={() => select(option.key)}
                  />
                ))
              ) : (
                <p className="px-2 py-2 text-sm text-stone-500">No matching languages</p>
              )}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};
