import * as Watch from '@moq/watch';

import type { MoqConnectionSignal } from './types';

// Mirrors the cross-broadcast synchronization used by moq-live-translation
// (apps/web/src/synced-playback.ts). The original video and a translated audio
// track come from *different* broadcasts, so we run both through a single shared
// clock instead of two independent MultiBackends (which drift apart).
//
// The clock has two modes:
//   - "earliest" (original audio): the earliest frame relative to its timestamp
//     anchors the reference, exactly like the library's default Sync. Audio and
//     video ride the same broadcast, so they are already aligned.
//   - "audio-clocked" (translated audio): only the audio stream advances the
//     reference, so the (lower latency) original video waits for the delayed
//     translated audio. buffer = max(audio, video) + jitter.

type Milli = Watch.Lite.Time.Milli;
const Time = Watch.Lite.Time;

const MIN_JITTER_MS = 20 as Milli;
const FALLBACK_JITTER_MS = 100 as Milli;

// When switching language, keep the current audio playing while the new translation
// broadcast connects and announces its catalog. If it never does (e.g. the language
// was never published), commit anyway after this long so a bad selection can't hang.
const CATALOG_READY_TIMEOUT_MS = 8000;

export const toLatency = (latencyMs: number): Watch.Latency =>
  latencyMs === 0 ? 'real-time' : (latencyMs as Milli);

type Wake = {
  promise: Promise<void>;
  resolve: () => void;
};

const createWake = (): Wake => {
  let resolve: () => void = () => {};
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

type AdaptiveSyncProps = {
  latency: Watch.Signals.Signal<Watch.Latency>;
  connection: MoqConnectionSignal;
};

// Duck-typed replacement for the library's Sync: the Source/Decoder pipeline only
// calls `received`, `now` and `wait`, plus reads the `reference`/`buffer`/`timestamp`
// signals. We re-implement those so the reference clock can be driven by audio.
class AdaptiveSync {
  readonly reference = new Watch.Signals.Signal<Milli | undefined>(undefined);
  readonly latency: Watch.Signals.Signal<Watch.Latency>;
  readonly jitter = new Watch.Signals.Signal<Milli>(FALLBACK_JITTER_MS);
  readonly audio = new Watch.Signals.Signal<Milli | undefined>(undefined);
  readonly video = new Watch.Signals.Signal<Milli | undefined>(undefined);
  readonly buffer = new Watch.Signals.Signal<Milli>(Time.Milli.zero);
  readonly timestamp = new Watch.Signals.Signal<Milli | undefined>(undefined);

  // When true, only audio frames advance the reference clock (translated audio is
  // the master; the original video is slaved to it).
  readonly audioClocked = new Watch.Signals.Signal<boolean>(false);

  #connection: MoqConnectionSignal;
  #minRtt: number | undefined;
  #update = createWake();
  #signals = new Watch.Signals.Effect();
  #closed = false;

  constructor(props: AdaptiveSyncProps) {
    this.latency = props.latency;
    this.#connection = props.connection;

    this.#signals.run(this.#runJitter.bind(this));
    this.#signals.run(this.#runBuffer.bind(this));
  }

  received(timestamp: Milli, label = '') {
    this.timestamp.update((current) => (current === undefined || timestamp > current ? timestamp : current));

    const ref = Time.Milli.sub(Time.Milli.now(), timestamp);

    if (this.audioClocked.peek()) {
      // Audio is the master clock; ignore video frames for anchoring.
      if (label !== 'audio') {
        return;
      }

      this.reference.set(ref);
      this.#wake();
      return;
    }

    // Earliest-frame clock: keep the smallest (now - timestamp) seen so far.
    const current = this.reference.peek();
    if (current !== undefined && ref >= current) {
      return;
    }

    this.reference.set(ref);
    this.#wake();
  }

  now(): Milli | undefined {
    const reference = this.reference.peek();
    if (reference === undefined) {
      return undefined;
    }

    return Time.Milli.sub(Time.Milli.sub(Time.Milli.now(), reference), this.buffer.peek());
  }

  async wait(timestamp: Milli): Promise<void> {
    for (;;) {
      if (this.#closed) {
        return;
      }

      const reference = this.reference.peek();
      if (reference === undefined) {
        await this.#update.promise;
        continue;
      }

      const now = Time.Milli.now();
      const ref = Time.Milli.sub(now, timestamp);
      const sleep = Time.Milli.add(Time.Milli.sub(reference, ref), this.buffer.peek());

      if (sleep <= 0 || sleep < 5) {
        return;
      }

      const timer = new Promise<'timer'>((resolve) => {
        window.setTimeout(() => resolve('timer'), sleep);
      });
      const changed = this.#update.promise.then(() => 'changed' as const);
      const result = await Promise.race([timer, changed]);
      if (result === 'timer') {
        return;
      }
    }
  }

  close() {
    this.#closed = true;
    this.#signals.close();
    this.#wake();
  }

  #runJitter(effect: Watch.Signals.Effect) {
    const latency = effect.get(this.latency);

    if (typeof latency === 'number') {
      this.#minRtt = undefined;
      this.jitter.set(latency);
      return;
    }

    const connection = effect.get(this.#connection) as
      | { rtt?: Watch.Signals.Getter<number | undefined> }
      | undefined;
    const rttSignal = connection?.rtt;
    const rtt = rttSignal ? effect.get(rttSignal) : undefined;

    if (rtt !== undefined) {
      this.#minRtt = this.#minRtt !== undefined ? Math.min(this.#minRtt, rtt) : rtt;
      this.jitter.set(Math.max(MIN_JITTER_MS, this.#minRtt * 1.25) as Milli);
      return;
    }

    this.#minRtt = undefined;
    this.jitter.set(FALLBACK_JITTER_MS);
  }

  #runBuffer(effect: Watch.Signals.Effect) {
    const jitter = effect.get(this.jitter);
    const video = effect.get(this.video) ?? Time.Milli.zero;
    const audio = effect.get(this.audio) ?? Time.Milli.zero;
    const buffer = Time.Milli.add(Time.Milli.max(video, audio), jitter);

    this.buffer.set(buffer);
    this.#wake();
  }

  #wake() {
    this.#update.resolve();
    this.#update = createWake();
  }
}

export type SyncedPlaybackProps = {
  connection: MoqConnectionSignal;
  // The remote peer's video broadcast (reused from the tile; not closed by us).
  videoBroadcast: Watch.Broadcast;
  // Latency used while playing the original audio (rides the video broadcast).
  latency: Watch.Latency;
  muted?: boolean;
};

/**
 * One persistent video + audio pipeline driven by a shared clock. The video
 * source always points at the peer's broadcast; the audio source switches
 * between that broadcast (original audio) and a translation broadcast at
 * runtime, so toggling the language never rebuilds the video and never flashes.
 *
 * Structurally exposes the `element` / `video.source` / `video.timestamp` /
 * `audio.muted` members that `VideoTile`/`VideoSurface` read off a MultiBackend,
 * so it can be passed where a backend is expected.
 */
export class SyncedPlayback {
  readonly element = new Watch.Signals.Signal<HTMLCanvasElement | HTMLVideoElement | undefined>(undefined);
  readonly latency: Watch.Signals.Signal<Watch.Latency>;
  readonly muted: Watch.Signals.Signal<boolean>;
  readonly sync: AdaptiveSync;

  readonly videoSource: Watch.Video.Source;
  readonly audioSource: Watch.Audio.Source;

  // MultiBackend-compatible surface consumed by VideoTile/VideoSurface.
  readonly video: { source: Watch.Video.Source; timestamp: Watch.Signals.Getter<Milli | undefined> };
  readonly audio: { muted: Watch.Signals.Signal<boolean> };

  #connection: MoqConnectionSignal;
  #videoBroadcast: Watch.Broadcast;
  #audioBroadcast: Watch.Broadcast | undefined;
  #audioPath: string | undefined;
  // Bumped on every setTranslationPath call so a slow broadcast that becomes ready
  // after a newer selection (or after close) is discarded instead of committed.
  #switchToken = 0;
  // Translation broadcasts that are buffering but not yet swapped in, so they can be
  // closed if this playback closes before they become ready.
  #pendingBroadcasts = new Set<Watch.Broadcast>();
  // Latency applied per mode. The active one is chosen at commit time so selecting a
  // language never shrinks the video buffer before the translation is swapped in.
  #videoLatency: Watch.Latency;
  #translationLatency: Watch.Latency;

  #videoDecoder: Watch.Video.Decoder;
  #audioDecoder: Watch.Audio.Decoder;
  #renderer: Watch.Video.Renderer;
  #emitter: Watch.Audio.Emitter;
  #closed = false;

  constructor(props: SyncedPlaybackProps) {
    this.#connection = props.connection;
    this.#videoBroadcast = props.videoBroadcast;

    this.latency = new Watch.Signals.Signal<Watch.Latency>(props.latency);
    this.#videoLatency = props.latency;
    this.#translationLatency = props.latency;
    this.muted = new Watch.Signals.Signal<boolean>(props.muted ?? false);

    this.sync = new AdaptiveSync({ latency: this.latency, connection: props.connection });
    const sync = this.sync as unknown as Watch.Sync;

    this.videoSource = new Watch.Video.Source(sync, { broadcast: props.videoBroadcast });
    // Audio starts on the same broadcast as video (original audio).
    this.audioSource = new Watch.Audio.Source(sync, { broadcast: props.videoBroadcast });

    this.#videoDecoder = new Watch.Video.Decoder(this.videoSource);
    this.#audioDecoder = new Watch.Audio.Decoder(this.audioSource);
    this.#emitter = new Watch.Audio.Emitter(this.#audioDecoder, { muted: this.muted });
    this.#renderer = new Watch.Video.Renderer(this.#videoDecoder, {
      canvas: this.element as unknown as Watch.Signals.Signal<HTMLCanvasElement | undefined>,
    });

    // Expose the *decoder's* playback timestamp (set only once a frame is actually
    // scheduled by the sync clock), not the renderer's — the renderer paints the
    // first decoded frame immediately as a preview, so its timestamp would flip
    // defined right away and make VideoTile hide the loading spinner over a frozen
    // frame while the buffer (videoLatencyMs) is still filling. The decoder
    // timestamp advances only when real playback begins, matching MultiBackend.
    this.video = { source: this.videoSource, timestamp: this.#videoDecoder.timestamp };
    this.audio = { muted: this.muted };
  }

  // Switch the audio between the original broadcast and a translation broadcast.
  // Passing `undefined` returns to the original audio (earliest-frame clock).
  //
  // Switching to a translation keeps the *current* audio + video playing while the
  // new translation broadcast connects and announces its catalog, and only then
  // swaps it in. The picture never freezes waiting for a not-yet-connected stream.
  setTranslationPath(path: string | undefined) {
    if (path === this.#audioPath) {
      return;
    }
    this.#audioPath = path;
    const token = ++this.#switchToken;

    // Original audio rides the always-on video broadcast, so it is already buffered
    // and can be swapped in straight away.
    if (!path) {
      this.#commitAudio(undefined);
      return;
    }

    // Start buffering the translation broadcast without touching the live pipeline,
    // and only commit once it is ready (or after a timeout, as a fallback).
    const broadcast = new Watch.Broadcast({
      connection: this.#connection,
      enabled: true,
      name: Watch.Lite.Path.from(path),
    });
    this.#pendingBroadcasts.add(broadcast);

    void this.#waitForCatalog(broadcast, token).then((ready) => {
      this.#pendingBroadcasts.delete(broadcast);

      // A newer selection (or close) superseded this one while we waited.
      if (!ready || this.#closed || token !== this.#switchToken) {
        broadcast.close();
        return;
      }
      this.#commitAudio(broadcast);
    });
  }

  // Point the audio pipeline at `broadcast` (or back at the original video broadcast
  // when undefined) and close the broadcast it replaces. The reference clock is left
  // running so the picture keeps playing: in audio-clocked mode the new translation
  // audio re-anchors it on its first frame, and in earliest mode the original frames
  // pull it back. (The old code dropped the reference to `undefined` here, which is
  // what froze the picture until the new stream connected.)
  #commitAudio(broadcast: Watch.Broadcast | undefined) {
    const previous = this.#audioBroadcast;

    if (broadcast) {
      this.#audioBroadcast = broadcast;
      this.audioSource.broadcast.set(broadcast);
      this.sync.audioClocked.set(true);
    } else {
      this.#audioBroadcast = undefined;
      this.audioSource.broadcast.set(this.#videoBroadcast);
      this.sync.audioClocked.set(false);
    }

    // Switch the buffer to match the new mode at the same instant as the audio, so
    // the video re-aligns in one step instead of jumping when the language is picked.
    this.latency.set(broadcast ? this.#translationLatency : this.#videoLatency);

    previous?.close();
  }

  // Resolve true once the broadcast has announced its catalog (its tracks are about
  // to flow), or false if this playback closed / the selection was superseded. Falls
  // back to true after CATALOG_READY_TIMEOUT_MS so a never-published language still
  // commits instead of hanging (the picture keeps playing on the existing clock).
  #waitForCatalog(broadcast: Watch.Broadcast, token: number): Promise<boolean> {
    return new Promise((resolve) => {
      if (broadcast.catalog.peek()) {
        resolve(true);
        return;
      }

      let settled = false;
      let dispose = () => {};
      const finish = (ready: boolean) => {
        if (settled) {
          return;
        }
        settled = true;
        dispose();
        window.clearTimeout(timer);
        resolve(ready);
      };

      const timer = window.setTimeout(() => finish(true), CATALOG_READY_TIMEOUT_MS);

      dispose = broadcast.catalog.subscribe(() => {
        if (broadcast.catalog.peek()) {
          finish(true);
        } else if (this.#closed || token !== this.#switchToken) {
          finish(false);
        }
      });
    });
  }

  // Update the latency used for each mode. Applies the one matching the *current*
  // (committed) mode, so selecting a language doesn't shrink the video buffer until
  // the translation is actually swapped in (see #commitAudio).
  setLatencies(videoLatency: Watch.Latency, translationLatency: Watch.Latency) {
    this.#videoLatency = videoLatency;
    this.#translationLatency = translationLatency;
    this.latency.set(this.sync.audioClocked.peek() ? translationLatency : videoLatency);
  }

  setMuted(muted: boolean) {
    this.muted.set(muted);
  }

  close() {
    if (this.#closed) {
      return;
    }
    this.#closed = true;

    this.#renderer.close();
    this.#emitter.close();
    this.#videoDecoder.close();
    this.#audioDecoder.close();
    this.videoSource.close();
    this.audioSource.close();
    this.sync.close();
    // Only close the translation broadcasts we created; the video broadcast is
    // owned by useMoqConnection (the tile) and may outlive this playback.
    this.#audioBroadcast?.close();
    for (const broadcast of this.#pendingBroadcasts) {
      broadcast.close();
    }
    this.#pendingBroadcasts.clear();
  }
}
