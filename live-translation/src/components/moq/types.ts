import type * as Publish from '@moq/publish';
import type { Signal } from '@moq/signals';
import type * as Watch from '@moq/watch';

export type MoqRoomForm = {
  roomName: string;
  peerName: string;
  url: string;
};

export type MoqQualityPreference = 'auto' | 'minimum' | 'maximum';

// Signal holding the active MoQ connection, used to subscribe to translation broadcasts.
export type MoqConnectionSignal = Signal<Publish.Lite.Connection.Established | undefined>;

// A translated audio broadcast available for a remote peer, published by
// moq-live-translation at `<peer>/<provider>/translation/<language>`.
export type TranslationOption = {
  // Stable identifier for the option, `${provider}:${language}`.
  key: string;
  provider: string;
  language: string;
  // Full broadcast path to subscribe to for the translated audio.
  path: string;
  // Human-readable label, e.g. "Spanish (OpenAI)".
  label: string;
};

export type MoqTile = {
  peerId: string;
  type: 'video' | 'screenshare';
  name?: string;
  local: boolean;
  isMuted: boolean;
  hasVideo: boolean;
  stream?: MediaStream | null;
  broadcast?: Watch.Broadcast;
  // Translated audio broadcasts available for this peer (remote video tiles only).
  translations?: TranslationOption[];
};

export type MoqConnectionStatus = 'disconnected' | 'connecting' | 'connected';

export type MoqSession = {
  roomName: string;
  peerName: string;
  url: string;
};
