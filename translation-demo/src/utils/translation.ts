import type * as Watch from "@moq/watch";

import { FISHJAM_ID } from "@/config";
import {
  compareGoogleLanguageCodes,
  formatGoogleLanguage,
  getGoogleLanguage,
} from "./googleLanguages";
import type { TranslationOption } from "./types";

// Keep subscribed media downloading even when the canvas is off-screen or the tab is hidden.
export const MEDIA_VISIBLE: Watch.Video.Visible = "always";

// Dynamic translation provider broadcasts live at `<source>/<provider>/translation`.
// Older translation services may still announce `<source>/<provider>/translation/<target-language>`.
const TRANSLATION_SEGMENT = "translation";

const PROVIDER_LABELS: Record<string, string> = {
  openai: "OpenAI",
  google: "Google",
};

const titleCase = (value: string) =>
  value
    .split(/[\s-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

export const formatProviderLabel = (provider: string) =>
  PROVIDER_LABELS[provider.toLowerCase()] ?? titleCase(provider);

const formatLanguageLabel = (language: string) => {
  if (getGoogleLanguage(language)) {
    return formatGoogleLanguage(language);
  }

  // Non-Google codes are rare: bare BCP-47 / ISO codes look better uppercased, full names
  // get title-cased.
  const lower = language.toLowerCase();
  return lower.length <= 3 && !lower.includes(" ")
    ? language.toUpperCase()
    : titleCase(language);
};

type ParsedTranslationPath = {
  sourcePath: string;
  provider: string;
};

// Returns the source broadcast and provider for a translation provider broadcast, or null when
// the path is not one. The shape is `[<source>/]<provider>/translation` (the source prefix may
// be empty when the connection URL already points at the source broadcast). Languages live as
// audio tracks inside this broadcast, so `translation` is always the final segment.
export const parseTranslationPath = (
  path: string,
): ParsedTranslationPath | null => {
  const segments = path.split("/").filter(Boolean);
  const translationIndex = segments.lastIndexOf(TRANSLATION_SEGMENT);

  // Need a provider segment immediately before a trailing `translation`.
  if (translationIndex < 1 || translationIndex !== segments.length - 1) {
    return null;
  }

  const provider = segments[translationIndex - 1];
  if (!provider) {
    return null;
  }

  return {
    sourcePath: segments.slice(0, translationIndex - 1).join("/"),
    provider,
  };
};

export const buildTranslationOption = ({
  provider,
  language,
  path,
  trackName,
  status,
  broadcast,
}: Pick<
  TranslationOption,
  "provider" | "language" | "path" | "trackName" | "status" | "broadcast"
>): TranslationOption => ({
  key: `${provider}:${language}`,
  provider,
  language,
  path,
  trackName,
  status,
  broadcast,
  label: formatLanguageLabel(language),
});

export const compareTranslationOptions = (
  left: TranslationOption,
  right: TranslationOption,
) => {
  if (left.status !== right.status) {
    return left.status === "active" ? -1 : 1;
  }

  const providerCompare = formatProviderLabel(left.provider).localeCompare(
    formatProviderLabel(right.provider),
  );
  if (providerCompare !== 0) {
    return providerCompare;
  }

  if (getGoogleLanguage(left.language) || getGoogleLanguage(right.language)) {
    return compareGoogleLanguageCodes(left.language, right.language);
  }

  return left.label.localeCompare(right.label);
};

export const getTranslationTargetId = (path: string, trackName: string) =>
  `${path}#${trackName}`;

// The Fishjam MoQ relay. All connections go here.
const RELAY_URL = "https://relay.fishjam.io";

const getFishjamId = () => {
  if (!FISHJAM_ID) {
    throw new Error(
      "VITE_FISHJAM_ID is not set — provide your Fishjam ID (see .env.example).",
    );
  }
  return FISHJAM_ID;
};

// Every connection goes to `<relay>/<fishjam-id>`: the Fishjam ID is the root namespace, and
// streams are published and discovered relative to it. Both publisher and viewer connect here;
// what they may do is decided by the MoQ token, not the URL path. A token for stream `<name>`
// authorises the path `<fishjam-id>/<name>` — the Fishjam ID is prepended server-side, so it is
// never part of the stream name we request a token for. The publisher then announces the stream
// as the single-segment broadcast `<name>`, with its translation tracks alongside at
// `<name>/<provider>/translation/<lang>`.
export const buildConnectionUrl = () => {
  const url = new URL(RELAY_URL);
  url.pathname = `/${getFishjamId()}`;
  return url;
};
