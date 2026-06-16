import type * as Watch from '@moq/watch';

import { compareGoogleLanguageCodes, formatGoogleLanguage, getGoogleLanguage } from './googleLanguages';
import type { TranslationOption } from './types';

// Keep subscribed media downloading even when the canvas is off-screen or the tab is hidden.
export const MEDIA_VISIBLE: Watch.Video.Visible = 'always';

// Dynamic translation provider broadcasts live at `<source>/<provider>/translation`.
// Older translation services may still announce `<source>/<provider>/translation/<target-language>`.
const TRANSLATION_SEGMENT = 'translation';

const PROVIDER_LABELS: Record<string, string> = {
  openai: 'OpenAI',
  google: 'Google',
};

const titleCase = (value: string) =>
  value
    .split(/[\s-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

export const formatProviderLabel = (provider: string) => PROVIDER_LABELS[provider.toLowerCase()] ?? titleCase(provider);

const formatLanguageLabel = (language: string) => {
  if (getGoogleLanguage(language)) {
    return formatGoogleLanguage(language);
  }

  // Non-Google codes are rare: bare BCP-47 / ISO codes look better uppercased, full names
  // get title-cased.
  const lower = language.toLowerCase();
  return lower.length <= 3 && !lower.includes(' ') ? language.toUpperCase() : titleCase(language);
};

const slugSegment = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'stream';

type ParsedTranslationPath = {
  sourcePath: string;
  provider: string;
};

// Returns the source broadcast and provider for a translation provider broadcast, or null when
// the path is not one. The shape is `[<source>/]<provider>/translation` (the source prefix may
// be empty when the connection URL already points at the source broadcast). Languages live as
// audio tracks inside this broadcast, so `translation` is always the final segment.
export const parseTranslationPath = (path: string): ParsedTranslationPath | null => {
  const segments = path.split('/').filter(Boolean);
  const translationIndex = segments.lastIndexOf(TRANSLATION_SEGMENT);

  // Need a provider segment immediately before a trailing `translation`.
  if (translationIndex < 1 || translationIndex !== segments.length - 1) {
    return null;
  }

  const provider = segments[translationIndex - 1];
  if (!provider) {
    return null;
  }

  return { sourcePath: segments.slice(0, translationIndex - 1).join('/'), provider };
};

export const buildTranslationOption = ({
  provider,
  language,
  path,
  trackName,
  status,
  broadcast,
}: Pick<TranslationOption, 'provider' | 'language' | 'path' | 'trackName' | 'status' | 'broadcast'>): TranslationOption => ({
  key: `${provider}:${language}`,
  provider,
  language,
  path,
  trackName,
  status,
  broadcast,
  label: formatLanguageLabel(language),
});

export const compareTranslationOptions = (left: TranslationOption, right: TranslationOption) => {
  if (left.status !== right.status) {
    return left.status === 'active' ? -1 : 1;
  }

  const providerCompare = formatProviderLabel(left.provider).localeCompare(formatProviderLabel(right.provider));
  if (providerCompare !== 0) {
    return providerCompare;
  }

  if (getGoogleLanguage(left.language) || getGoogleLanguage(right.language)) {
    return compareGoogleLanguageCodes(left.language, right.language);
  }

  return left.label.localeCompare(right.label);
};

export const getTranslationTargetId = (path: string, trackName: string) => `${path}#${trackName}`;

// The MoQ relay URL must be supplied via VITE_MOQ_URL (e.g. in a .env file) — there is no
// built-in default.
const getMoqUrl = () => {
  const url = import.meta.env.VITE_MOQ_URL;
  if (!url) {
    throw new Error('VITE_MOQ_URL is not set — provide the MoQ relay URL (see .env.example).');
  }
  return url;
};

// The publisher broadcasts under `<base>/translations/<name>`; its translation tracks
// are published alongside at `<base>/translations/<name>/<provider>/translation/<lang>`.
const TRANSLATIONS_PREFIX = 'translations';

const appendSegments = (...segments: string[]) => {
  const url = new URL(getMoqUrl());
  const trimmedPath = url.pathname.replace(/\/+$/, '');

  url.pathname = [trimmedPath, ...segments].join('/');
  return url;
};

// Connection URL the publisher connects to. The namespace (`.../translations`) lives in
// the connection path and the stream name is published as a single-segment broadcast
// leaf, matching what the relay accepts (publishing a multi-segment name is rejected).
export const buildTranslationsConnectionUrl = () => appendSegments(TRANSLATIONS_PREFIX);

// Connection URL for the QR-shared viewer: it points straight at a single broadcast so
// the relay only announces that stream and its translations (everything else under
// `translations/` stays invisible).
export const buildStreamConnectionUrl = (streamName: string) =>
  appendSegments(TRANSLATIONS_PREFIX, slugSegment(streamName));
