import type * as Publish from '@moq/publish';
import type { Signal } from '@moq/signals';
import type * as Watch from '@moq/watch';

// Signal holding the active MoQ connection, used to subscribe to translation broadcasts.
export type MoqConnectionSignal = Signal<Publish.Lite.Connection.Established | undefined>;

type TranslationStatus = 'active' | 'requestable';

// A translated audio option available for the stream. Translations share a provider broadcast at
// `<stream>/<provider>/translation` and use `trackName` as the requested language audio rendition.
export type TranslationOption = {
  // Stable identifier for the option, `${provider}:${language}`.
  key: string;
  provider: string;
  language: string;
  // The provider broadcast path.
  path: string;
  // Audio rendition (language) to request from the provider broadcast.
  trackName: string;
  // Whether the rendition already exists in the catalog or must be requested.
  status: TranslationStatus;
  // Shared provider broadcast the rendition lives in.
  broadcast: Watch.Broadcast;
  // Human-readable language label, e.g. "Spanish (es)".
  label: string;
};

export type MoqStream = {
  // The stream's broadcast path (empty for a stream announced at the connection root).
  path: string;
  hasVideo: boolean;
  broadcast?: Watch.Broadcast;
  // Translated audio broadcasts available for this stream.
  translations?: TranslationOption[];
};

export type MoqConnectionStatus = 'disconnected' | 'connecting' | 'connected';
