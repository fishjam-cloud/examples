import * as Watch from "@moq/watch";
import { useEffect, useState } from "react";

import type {
  MoqConnectionSignal,
  MoqStream,
  TranslationOption,
} from "@/utils/types";
import { MEDIA_VISIBLE } from "@/utils/translation";

// Fixed end-to-end delay (ms) applied to the whole stream. Translations arrive ~3–4s behind
// the original, so we delay the picture (and original audio) by the same amount and time every
// audio track against one shared clock — then the translation for the shown moment has already
// arrived. Because the delay is constant, switching audio never moves the video timeline, so
// the picture never freezes. Trade-off: ~4.5s latency (and startup buffering) even on the
// original. Bigger = safer translation sync; smaller = less lag but risks underflow.
const STREAM_DELAY_MS = 4500;

// A newly selected language is crossfaded in only once its audio ring has actually un-stalled
// (the worklet is emitting sound at the play-head) — not merely when data has been downloaded,
// which happens ~1s earlier and would fade the old track out into a silent gap. A short floor
// debounces a transient un-stall; the timeout is a backstop after which we give up waiting and
// keep the current audio (a requestable language may take a while to be produced — the old
// track keeps playing throughout, so a generous value costs nothing).
const WARMUP_MIN_MS = 500;
const WARMUP_TIMEOUT_MS = 20_000;
const WARMUP_POLL_MS = 100;

// Gain crossfade duration (seconds) when a track becomes (in)audible.
const CROSSFADE_S = 0.2;

// Floor for a translation's jitter buffer once provider-delay compensation is applied, so a
// translation whose provider delay nearly equals STREAM_DELAY_MS still keeps a little buffer.
const MIN_TRANSLATION_LATENCY_MS = 400;

// Hang's PRIORITY.audio — used for the trigger subscription that requests a dynamic language.
const AUDIO_PRIORITY = 80;

export const ORIGINAL_AUDIO_KEY = "original";

// One audio track: its own decoder, clock, and a gain node mixing its output into the speakers.
// Decoded continuously (even while silent) so it stays warm and in sync; audibility is purely
// the gain.
//
// Audio plays at `(its broadcast's live edge) − clock.buffer`. The original's live edge ≈ the
// video's, so the original shares the player's clock (same delay as the picture). A translation
// arrives ~3–4s later, so it gets its OWN clock with a smaller latency
// (STREAM_DELAY_MS − providerDelay) — that lands it on the exact same play-head as the video.
type AudioVoice = {
  key: string;
  // The original stream broadcast or a shared translation provider broadcast — both owned by the
  // connection, so a voice never closes its broadcast.
  broadcast: Watch.Broadcast;
  // Language rendition to select for a translation; undefined uses the default (original) track.
  trackName?: string;
  sync: Watch.Sync;
  // True for a translation's dedicated clock (which we created and must close).
  ownsSync: boolean;
  source: Watch.Audio.Source;
  decoder: Watch.Audio.Decoder;
  signals: Watch.Signals.Effect;
  gain: Watch.Signals.Signal<GainNode | undefined>;
  // Target gain, applied as the node's initial value once the (async) AudioContext connects.
  desiredGain: number;
  // Whether provider-delay latency compensation has been applied (translations only, once).
  latencyAdjusted: boolean;
};

type VoiceConfig = {
  key: string;
  broadcast: Watch.Broadcast;
  trackName?: string;
  desiredGain: number;
  useOwnSync: boolean;
};

/**
 * Plays the viewer's stream: the original video plus a selectable audio track (original or a
 * translation), all driven by a shared {@link Watch.Sync} clock at a fixed {@link STREAM_DELAY_MS}
 * delay so audio and video stay aligned by timestamp.
 *
 * A translation shares a provider broadcast and picks a language rendition by `trackName`
 * (requesting it first if it isn't being produced yet). Multiple audio tracks decode at once: when
 * a translation is selected the current track keeps playing while the new one warms up, then
 * they crossfade. The video pipeline is never touched by audio changes, so it never freezes.
 */
export class SyncedStreamPlayer {
  readonly sync: Watch.Sync;
  // Media timestamp of the most recent decoded video frame; undefined until the first frame.
  readonly videoTimestamp: Watch.Video.Decoder["timestamp"];
  // The track currently heard, and the one warming up (if any) — exposed for the UI.
  readonly audibleKey = new Watch.Signals.Signal<string>(ORIGINAL_AUDIO_KEY);
  readonly pendingKey = new Watch.Signals.Signal<string | undefined>(undefined);

  readonly #connection: MoqConnectionSignal;
  readonly #videoSource: Watch.Video.Source;
  readonly #videoDecoder: Watch.Video.Decoder;
  readonly #renderer: Watch.Video.Renderer;

  readonly #voices = new Map<string, AudioVoice>();
  #warmupTimer: number | undefined;

  constructor(
    originalBroadcast: Watch.Broadcast,
    connection: MoqConnectionSignal,
  ) {
    this.#connection = connection;

    this.sync = new Watch.Sync({
      latency: STREAM_DELAY_MS as Watch.Net.Time.Milli,
      connection,
    });

    this.#videoSource = new Watch.Video.Source(this.sync, {
      broadcast: originalBroadcast,
    });
    this.#videoDecoder = new Watch.Video.Decoder(this.#videoSource);
    this.#renderer = new Watch.Video.Renderer(this.#videoDecoder, {
      paused: false,
      visible: MEDIA_VISIBLE,
    });
    this.videoTimestamp = this.#videoDecoder.timestamp;

    // The original audio is always present, kept warm, and audible by default. It shares the
    // player clock (it plays at the same delay as the video).
    this.#voices.set(
      ORIGINAL_AUDIO_KEY,
      this.#createVoice({
        key: ORIGINAL_AUDIO_KEY,
        broadcast: originalBroadcast,
        desiredGain: 1,
        useOwnSync: false,
      }),
    );
  }

  attachCanvas(canvas: HTMLCanvasElement | null): void {
    this.#renderer.canvas.set(canvas ?? undefined);
  }

  /**
   * Select the audible audio track. Passing `undefined` (or the original) is instant — the
   * original is always kept warm. Selecting a translation keeps the current track audible until
   * the new one has buffered, then crossfades — so there is no silent gap and the picture never
   * freezes. A requestable translation is activated on demand (the provider starts producing it).
   */
  selectAudio(translation: TranslationOption | undefined): void {
    if (!translation) {
      this.#cancelWarmup();
      this.#crossfadeTo(ORIGINAL_AUDIO_KEY);
      return;
    }

    const key = translation.key;

    // Already warming up this one, or already heard with nothing newer warming up.
    if (this.pendingKey.peek() === key) {
      return;
    }
    if (
      this.audibleKey.peek() === key &&
      this.pendingKey.peek() === undefined
    ) {
      return;
    }

    this.#cancelWarmup();

    let voice = this.#voices.get(key);
    if (!voice) {
      voice = this.#createTranslationVoice(translation);
      this.#voices.set(key, voice);
    }

    this.pendingKey.set(key);
    this.#warmup(voice);
  }

  close(): void {
    this.#cancelWarmup();
    this.#renderer.close();
    this.#videoDecoder.close();
    this.#videoSource.close();
    for (const voice of this.#voices.values()) {
      this.#closeVoice(voice);
    }
    this.#voices.clear();
    this.sync.close();
  }

  #createTranslationVoice(translation: TranslationOption): AudioVoice {
    // A language rendition (`trackName`) inside the shared provider broadcast (owned by the
    // connection). Requested on demand if it isn't being produced yet.
    return this.#createVoice({
      key: translation.key,
      broadcast: translation.broadcast,
      trackName: translation.trackName,
      desiredGain: 0,
      useOwnSync: true,
    });
  }

  #createVoice({
    key,
    broadcast,
    trackName,
    desiredGain,
    useOwnSync,
  }: VoiceConfig): AudioVoice {
    // A translation gets its own clock so its jitter buffer (and thus playback delay) can be
    // shortened to compensate for the provider delay; the original shares the player clock.
    const sync = useOwnSync
      ? new Watch.Sync({
          latency: STREAM_DELAY_MS as Watch.Net.Time.Milli,
          connection: this.#connection,
        })
      : this.sync;

    const source = new Watch.Audio.Source(sync, { broadcast });
    const decoder = new Watch.Audio.Decoder(source);
    // Download & decode immediately so the track warms up (and stays ready) while silent.
    decoder.enabled.set(true);

    const gain = new Watch.Signals.Signal<GainNode | undefined>(undefined);
    const signals = new Watch.Signals.Effect();
    const voice: AudioVoice = {
      key,
      broadcast,
      trackName,
      sync,
      ownsSync: useOwnSync,
      source,
      decoder,
      signals,
      gain,
      desiredGain,
      latencyAdjusted: false,
    };

    // Dynamic translation: select the language rendition once the provider is producing it. If it
    // isn't yet (a "requestable" language), subscribing to the track triggers generation; when it
    // appears in the catalog this effect re-runs — closing the trigger first, then targeting the
    // rendition so the decoder subscribes (never two subscriptions to the track at once).
    if (trackName) {
      signals.run((effect) => {
        const active = effect.get(broadcast.active);
        if (!active) {
          return;
        }

        const renditions =
          effect.get(broadcast.catalog)?.audio?.renditions ?? {};
        if (renditions[trackName]) {
          source.target.set({ name: trackName });
          return;
        }

        source.target.set(undefined);
        const trigger = active.subscribe(trackName, AUDIO_PRIORITY);
        effect.cleanup(() => trigger.close());
      });
    }

    // Mix the decoder's worklet output through a gain node once its AudioContext exists. Even at
    // gain 0 the node stays in the graph, so the worklet keeps draining in sync — crossfading is
    // then just a gain ramp on an already time-aligned track.
    signals.run((effect) => {
      const context = effect.get(decoder.context);
      const root = effect.get(decoder.root);
      if (!context || !root) {
        return;
      }

      const node = new GainNode(context, { gain: voice.desiredGain });
      root.connect(node);
      node.connect(context.destination);
      gain.set(node);

      effect.cleanup(() => {
        node.disconnect();
        root.disconnect();
        gain.set(undefined);
      });
    });

    return voice;
  }

  #warmup(voice: AudioVoice): void {
    const startedAt = performance.now();

    const poll = () => {
      // Shorten the translation's jitter buffer to land it on the video play-head, before its
      // ring fills and un-stalls (so there is no audible skip afterwards).
      this.#compensateProviderDelay(voice);

      const elapsed = performance.now() - startedAt;

      if (elapsed >= WARMUP_MIN_MS && this.#isEmitting(voice)) {
        this.#warmupTimer = undefined;
        this.pendingKey.set(undefined);
        this.#crossfadeTo(voice.key);
        return;
      }

      if (elapsed >= WARMUP_TIMEOUT_MS) {
        // Gave up waiting (e.g. a requestable language never started). Keep the current audio and
        // drop the pending voice rather than crossfading into silence.
        this.#warmupTimer = undefined;
        this.pendingKey.set(undefined);
        this.#pruneVoices();
        return;
      }

      this.#warmupTimer = window.setTimeout(poll, WARMUP_POLL_MS);
    };

    poll();
  }

  // Set a translation's clock latency to STREAM_DELAY_MS − providerDelay, so it plays at the
  // same media position as the video instead of `providerDelay` behind it. Done once, while the
  // ring is still filling. providerDelay = (latest original ts) − (latest translation ts).
  #compensateProviderDelay(voice: AudioVoice): void {
    if (!voice.ownsSync || voice.latencyAdjusted) {
      return;
    }

    const originalTs = this.sync.timestamp.peek();
    const translationTs = voice.sync.timestamp.peek();
    if (originalTs === undefined || translationTs === undefined) {
      return;
    }

    const providerDelay = originalTs - translationTs;
    const latency = Math.max(
      MIN_TRANSLATION_LATENCY_MS,
      STREAM_DELAY_MS - providerDelay,
    );
    voice.sync.latency.set(latency as Watch.Net.Time.Milli);
    voice.latencyAdjusted = true;
  }

  #cancelWarmup(): void {
    if (this.#warmupTimer !== undefined) {
      clearTimeout(this.#warmupTimer);
      this.#warmupTimer = undefined;
    }
    this.pendingKey.set(undefined);
  }

  // True once the track's audio ring is actively emitting sound (not stalled waiting to fill).
  // The ring un-stalls when the play-head reaches buffered audio, so this is the moment the new
  // track can take over without a silent gap.
  #isEmitting(voice: AudioVoice): boolean {
    return voice.decoder.stalled.peek() === false;
  }

  #crossfadeTo(key: string): void {
    const previousKey = this.audibleKey.peek();
    const target = this.#voices.get(key);
    if (!target) {
      return;
    }

    this.#fade(target, 1);
    if (previousKey !== key) {
      const previous = this.#voices.get(previousKey);
      if (previous) {
        this.#fade(previous, 0);
      }
      this.audibleKey.set(key);
    }

    this.#pruneVoices();
  }

  #fade(voice: AudioVoice, target: number): void {
    voice.desiredGain = target;

    const node = voice.gain.peek();
    if (!node) {
      return; // Not connected yet; `target` becomes its initial gain on connect.
    }

    const now = node.context.currentTime;
    node.gain.cancelScheduledValues(now);
    node.gain.setValueAtTime(node.gain.value, now);
    node.gain.linearRampToValueAtTime(target, now + CROSSFADE_S);
  }

  // Drop translation voices that are neither audible, warming up, nor the (kept-warm) original.
  #pruneVoices(): void {
    const keep = new Set([
      ORIGINAL_AUDIO_KEY,
      this.audibleKey.peek(),
      this.pendingKey.peek(),
    ]);

    for (const [key, voice] of this.#voices) {
      if (keep.has(key)) {
        continue;
      }
      this.#closeVoice(voice);
      this.#voices.delete(key);
    }
  }

  #closeVoice(voice: AudioVoice): void {
    voice.signals.close();
    voice.decoder.close();
    voice.source.close();
    if (voice.ownsSync) {
      voice.sync.close();
    }
  }
}

export const useSyncedStreamPlayer = (
  stream: MoqStream | undefined,
  connection: MoqConnectionSignal,
) => {
  const [player, setPlayer] = useState<SyncedStreamPlayer | null>(null);

  const broadcast = stream?.broadcast;

  useEffect(() => {
    if (!broadcast) {
      setPlayer(null);
      return;
    }

    const created = new SyncedStreamPlayer(broadcast, connection);
    setPlayer(created);

    return () => {
      setPlayer(null);
      created.close();
    };
  }, [broadcast, connection]);

  return player;
};
