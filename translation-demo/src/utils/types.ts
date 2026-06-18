import type * as Publish from '@moq/publish';
import type { Signal } from '@moq/signals';
import type * as Watch from '@moq/watch';

export type MoqConnectionSignal = Signal<Publish.Lite.Connection.Established | undefined>;

type TranslationStatus = 'active' | 'requestable';

// A translated audio option available for the stream. Translations share a provider broadcast at
// `<stream>/<provider>/translation` and use `trackName` as the requested language audio rendition.
export type TranslationOption = {
  // Stable identifier for the option, `${provider}:${language}`.
  key: string;
  provider: string;
  language: string;
  path: string;
  // Audio rendition (language) to request from the provider broadcast.
  trackName: string;
  // Whether the rendition already exists in the catalog or must be requested.
  status: TranslationStatus;
  broadcast: Watch.Broadcast;
  label: string;
};

export type MoqStream = {
  // The stream's broadcast path (empty for a stream announced at the connection root).
  path: string;
  hasVideo: boolean;
  broadcast?: Watch.Broadcast;
  translations?: TranslationOption[];
};

export type MoqConnectionStatus = 'disconnected' | 'connecting' | 'connected';
