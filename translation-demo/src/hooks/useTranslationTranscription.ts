import * as Watch from "@moq/watch";
import { useCallback, useEffect, useRef, useState } from "react";

import type { TranslationOption } from "@/utils/types";
import { getTranslationTargetId } from "@/utils/translation";

export type TranscriptionState = {
  caption?: string;
  // Translation target whose transcription track turned out to be unavailable
  // (older server); used to disable the CC toggle.
  unavailableTarget?: string;
};

// Captions are a text track alongside the requested language audio track inside the provider
// broadcast: `<trackName>/transcript.json`.
const TRANSCRIPTION_TRACK_SUFFIX = "transcript.json";
// Hang's PRIORITY.chat: above audio (80), below catalog (100).
const TRANSCRIPTION_PRIORITY = 90;

const getTranscriptionTrackName = (trackName: string) =>
  `${trackName}/${TRANSCRIPTION_TRACK_SUFFIX}`;

// How long a caption (v1) or an individual segment (v2) stays on screen after
// it first appeared, when no newer text replaces it.
const CAPTION_EXPIRY_MS = 5_000;

// Re-derive the displayed caption on this cadence: segments become visible as
// the audio clock advances and age out on wall time, independent of updates.
const RECOMPUTE_INTERVAL_MS = 250;

// Show only the most recent tail of the caption, roughly two caption lines.
const MAX_CAPTION_CHARS = 120;

const trimCaption = (text: string): string => {
  if (text.length <= MAX_CAPTION_CHARS) {
    return text;
  }

  const tail = text.slice(-MAX_CAPTION_CHARS);
  const wordBoundary = tail.indexOf(" ");

  return `…${wordBoundary === -1 ? tail : tail.slice(wordBoundary + 1)}`;
};

// `Watch.Broadcast.active` exposes the underlying network broadcast.
type MoqBroadcast = NonNullable<ReturnType<Watch.Broadcast["active"]["peek"]>>;

// The translation audio playback clock (ms), used to reveal each caption segment only
// once the heard audio reaches its timestamp.
type PlaybackClock = { now: () => number | undefined };

type CaptionSegment = {
  text: string;
  // Microseconds on the same output clock as the translation audio frames.
  tsUs: number;
};

type TranscriptionEntry = {
  path: string;
  trackName: string;
  targetId: string;
  broadcast: Watch.Broadcast;
  dispose: () => void;
  closeTrack?: () => void;
  // v1 payload: the full rolling caption text + wall clock of the last update.
  plain?: { text: string; at: number };
  // v2 payload: the current segment window, replaced wholesale on each update.
  segments: CaptionSegment[];
  // Wall clock at which each segment (keyed by tsUs) first became visible.
  visibleSince: Map<number, number>;
};

// v2 sends `{"segments": [{"text", "ts_us", "final"?}]}`; anything else is the
// v1 plain rolling text. Returning a string means v1.
const parseUpdate = (raw: string): CaptionSegment[] | string => {
  if (!raw.trimStart().startsWith("{")) {
    return raw;
  }

  try {
    const parsed = JSON.parse(raw) as { segments?: unknown };

    if (Array.isArray(parsed.segments)) {
      return parsed.segments.flatMap((segment): CaptionSegment[] => {
        if (
          segment &&
          typeof segment === "object" &&
          typeof (segment as { text?: unknown }).text === "string" &&
          typeof (segment as { ts_us?: unknown }).ts_us === "number"
        ) {
          const { text, ts_us } = segment as { text: string; ts_us: number };

          return [{ text, tsUs: ts_us }];
        }

        return [];
      });
    }
  } catch {
    // Not JSON: fall through to plain text.
  }

  return raw;
};

const closeEntry = (entry: TranscriptionEntry) => {
  entry.dispose();
  entry.closeTrack?.();
};

/**
 * Subscribes to the live transcription of the selected translation broadcast.
 *
 * The transcription is a text track inside the translation broadcast carrying
 * the full current caption state on every update (replace semantics):
 * - v2: a JSON window of timestamped segments. Each segment is held until the
 *   translation audio playback reaches its timestamp, then shown until it ages
 *   out — so captions stay in sync with the heard audio and old text drops off
 *   gradually.
 * - v1 (fallback): the plain rolling text, shown immediately and cleared as a
 *   whole when it goes stale.
 */
export const useTranslationTranscription = (
  translation: TranslationOption | undefined,
  clock?: PlaybackClock,
): TranscriptionState => {
  const entryRef = useRef<TranscriptionEntry | null>(null);
  const [caption, setCaption] = useState<string | undefined>(undefined);
  const [unavailableTarget, setUnavailableTarget] = useState<
    string | undefined
  >(undefined);

  // Read the audio clock through a ref so `recompute` stays stable and doesn't
  // re-subscribe the transcription when the player appears.
  const clockRef = useRef(clock);
  clockRef.current = clock;

  const path = translation?.path;
  const trackName = translation?.trackName;
  const broadcast = translation?.broadcast;

  const recompute = useCallback(() => {
    const entry = entryRef.current;

    if (!entry) {
      setCaption(undefined);
      return;
    }

    const nowWall = performance.now();
    const text = entry.plain
      ? nowWall - entry.plain.at <= CAPTION_EXPIRY_MS
        ? entry.plain.text
        : ""
      : captionFromSegments(entry, clockRef.current?.now(), nowWall);
    const trimmed = trimCaption(text) || undefined;

    setCaption((current) => (current === trimmed ? current : trimmed));
  }, []);

  useEffect(() => {
    if (!path || !trackName || !broadcast) {
      setCaption(undefined);
      return;
    }

    const targetId = getTranslationTargetId(path, trackName);
    const entry: TranscriptionEntry = {
      path,
      trackName,
      targetId,
      broadcast,
      dispose: () => {},
      segments: [],
      visibleSince: new Map(),
    };

    const clearText = () => {
      entry.plain = undefined;
      entry.segments = [];
      entry.visibleSince.clear();
      recompute();
    };

    const applyUpdate = (raw: string) => {
      const parsed = parseUpdate(raw);

      if (typeof parsed === "string") {
        entry.segments = [];
        entry.visibleSince.clear();
        entry.plain = parsed
          ? { text: parsed, at: performance.now() }
          : undefined;
      } else {
        entry.plain = undefined;
        entry.segments = parsed;

        // Refinements replace trailing segments; forget timing of the gone ones.
        const kept = new Set(parsed.map((segment) => segment.tsUs));

        for (const key of entry.visibleSince.keys()) {
          if (!kept.has(key)) {
            entry.visibleSince.delete(key);
          }
        }
      }

      recompute();
    };

    // (Re)subscribe to the transcription track whenever the underlying
    // broadcast (re)connects.
    const watchActive = (activeBroadcast: MoqBroadcast | undefined) => {
      entry.closeTrack?.();
      entry.closeTrack = undefined;

      if (!activeBroadcast) {
        clearText();
        return;
      }

      const track = activeBroadcast.subscribe(
        getTranscriptionTrackName(trackName),
        TRANSCRIPTION_PRIORITY,
      );
      let cancelled = false;
      entry.closeTrack = () => {
        cancelled = true;
        track.close();
      };

      void (async () => {
        let received = false;

        try {
          for (;;) {
            const raw = await track.readString();

            if (raw === undefined) {
              break;
            }

            received = true;
            applyUpdate(raw);
          }
        } catch {
          // Treated as unavailable below unless we already got captions.
        }

        if (cancelled) {
          return;
        }

        clearText();

        // The track ended before delivering anything: the publisher doesn't
        // serve a transcription for this translation.
        if (!received) {
          setUnavailableTarget((current) =>
            current === targetId ? current : targetId,
          );
        }
      })();
    };

    entryRef.current = entry;
    watchActive(broadcast.active.peek());
    entry.dispose = broadcast.active.changed(watchActive);
    recompute();

    return () => {
      closeEntry(entry);
      if (entryRef.current === entry) {
        entryRef.current = null;
      }
      setCaption(undefined);
    };
  }, [path, trackName, broadcast, recompute]);

  // Segments become visible as the audio clock advances and expire on wall time,
  // both independent of track updates — re-derive on an interval.
  useEffect(() => {
    const interval = window.setInterval(recompute, RECOMPUTE_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [recompute]);

  return { caption, unavailableTarget };
};

const captionFromSegments = (
  entry: TranscriptionEntry,
  audioNowMs: number | undefined,
  nowWall: number,
): string => {
  const parts: string[] = [];

  for (const segment of entry.segments) {
    // Hold the segment until the (buffered) translation audio reaches it, so
    // captions match what is heard. Without a clock, show it immediately.
    if (audioNowMs !== undefined && segment.tsUs / 1000 > audioNowMs) {
      continue;
    }

    let since = entry.visibleSince.get(segment.tsUs);

    if (since === undefined) {
      since = nowWall;
      entry.visibleSince.set(segment.tsUs, since);
    }

    // Old segments drop off individually instead of the whole caption at once.
    if (nowWall - since > CAPTION_EXPIRY_MS) {
      continue;
    }

    parts.push(segment.text);
  }

  return parts.join(" ").replace(/\s+/g, " ").trim();
};
