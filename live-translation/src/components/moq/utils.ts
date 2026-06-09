import type { MoqTile, TranslationOption } from './types';

const MOQ_URL_STORAGE_KEY = 'moqUrl';
const DEFAULT_MOQ_URL = 'https://moq.fishjam.work/public';
const SCREENSHARE_PATH_SUFFIX = '--screen';

// Default playback jitter buffer target (ms) for translated audio backends. Passed as
// the MultiBackend `latency` to override the default "real-time" RTT-based jitter, so
// the bursty provider output has more buffer to play out smoothly. Original peer
// audio/video keep the default "real-time" latency. The user can adjust this live.
const MOQ_TARGET_LATENCY_MS = 500;

// Shared bounds (ms) used to validate persisted latency values.
const MOQ_LATENCY_MIN_MS = 0;
const MOQ_LATENCY_MAX_MS = 5000;

// Peer video (and the original peer audio that rides the same backend) defaults to a
// large delay so that switching the audio source never has to change the video latency
// and freeze the picture. With original audio both video and audio play at this delay;
// with a translation the video stays put while only the (separate) translation audio
// backend runs at the much shorter MOQ_TARGET_LATENCY_MS. The user can adjust it live.
const MOQ_VIDEO_LATENCY_DEFAULT_MS = 4100;

const MOQ_TRANSLATION_LATENCY_STORAGE_KEY = 'moqTranslationLatencyMs';
const MOQ_VIDEO_LATENCY_STORAGE_KEY = 'moqVideoLatencyMs';

const readPersistedLatencyMs = (storageKey: string, fallbackMs: number): number => {
  const raw = localStorage.getItem(storageKey);
  if (raw === null) {
    return fallbackMs;
  }

  const stored = Number(raw);
  if (!Number.isFinite(stored) || stored < MOQ_LATENCY_MIN_MS || stored > MOQ_LATENCY_MAX_MS) {
    return fallbackMs;
  }

  return stored;
};

export const getPersistedTranslationLatencyMs = (): number =>
  readPersistedLatencyMs(MOQ_TRANSLATION_LATENCY_STORAGE_KEY, MOQ_TARGET_LATENCY_MS);

export const getPersistedVideoLatencyMs = (): number =>
  readPersistedLatencyMs(MOQ_VIDEO_LATENCY_STORAGE_KEY, MOQ_VIDEO_LATENCY_DEFAULT_MS);

// Translation broadcasts published by moq-live-translation live at
// `<source>/<provider>/translation/<target-language>`.
const TRANSLATION_SEGMENT = 'translation';

const PROVIDER_LABELS: Record<string, string> = {
  openai: 'OpenAI',
  google: 'Google',
};

const LANGUAGE_LABELS: Record<string, string> = {
  en: 'English',
  es: 'Spanish',
  de: 'German',
  fr: 'French',
  it: 'Italian',
  pt: 'Portuguese',
  pl: 'Polish',
  nl: 'Dutch',
  ru: 'Russian',
  uk: 'Ukrainian',
  ja: 'Japanese',
  ko: 'Korean',
  zh: 'Chinese',
};

const titleCase = (value: string) =>
  value
    .split(/[\s-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const formatProviderLabel = (provider: string) => PROVIDER_LABELS[provider.toLowerCase()] ?? titleCase(provider);

const formatLanguageLabel = (language: string) => {
  const lower = language.toLowerCase();
  if (LANGUAGE_LABELS[lower]) {
    return LANGUAGE_LABELS[lower];
  }

  // Bare BCP-47 / ISO codes look better uppercased; full names get title-cased.
  return lower.length <= 3 && !lower.includes(' ') ? language.toUpperCase() : titleCase(language);
};

const slugSegment = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'room';

export const isScreensharePath = (path: string) => path.endsWith(SCREENSHARE_PATH_SUFFIX);

type ParsedTranslationPath = {
  sourcePath: string;
  provider: string;
  language: string;
};

// Returns the source broadcast, provider and target language for a translation
// path, or null when the path is not a translation broadcast.
//
// The path shape is `[<source>/]<provider>/translation/<language>`. The source
// prefix may be empty: when the connection URL already points at the broadcast
// (e.g. `.../public/mikel-arteta`), the stream is announced at the room root and
// its translations are announced as bare `<provider>/translation/<language>`.
export const parseTranslationPath = (path: string): ParsedTranslationPath | null => {
  const segments = path.split('/').filter(Boolean);
  const translationIndex = segments.indexOf(TRANSLATION_SEGMENT);

  // Need a provider segment immediately before `translation` and a language
  // segment after it; any segments before the provider form the (optional) source.
  if (translationIndex < 1 || translationIndex + 1 >= segments.length) {
    return null;
  }

  const provider = segments[translationIndex - 1];
  const language = segments[translationIndex + 1];
  const sourcePath = segments.slice(0, translationIndex - 1).join('/');

  if (!provider || !language) {
    return null;
  }

  return { sourcePath, provider, language };
};

export const buildTranslationOption = (parsed: ParsedTranslationPath, path: string): TranslationOption => ({
  key: `${parsed.provider}:${parsed.language}`,
  provider: parsed.provider,
  language: parsed.language,
  path,
  label: `${formatLanguageLabel(parsed.language)} (${formatProviderLabel(parsed.provider)})`,
});

const getDefaultMoqUrl = () =>
  import.meta.env.VITE_MOQ_URL ?? localStorage.getItem(MOQ_URL_STORAGE_KEY) ?? DEFAULT_MOQ_URL;

// The publisher broadcasts under `<base>/translations/<name>`; its translation tracks
// are published alongside at `<base>/translations/<name>/<provider>/translation/<lang>`.
const TRANSLATIONS_PREFIX = 'translations';

const appendSegments = (...segments: string[]) => {
  const url = new URL(getDefaultMoqUrl());
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

export const getTileId = (tile: MoqTile) => `${tile.peerId}-${tile.type}`;

export const prettyPeerName = (path: string) => {
  const lastSegment =
    path
      .split('/')
      .at(-1)
      ?.replace(new RegExp(`${SCREENSHARE_PATH_SUFFIX}$`), '') ?? 'peer';
  const strippedSuffix = lastSegment.replace(/-[a-f0-9]{8}$/i, '');

  return strippedSuffix
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

export const formatTileName = (name: string, type: MoqTile['type']) =>
  type === 'screenshare' ? `${name} Screen` : name;
