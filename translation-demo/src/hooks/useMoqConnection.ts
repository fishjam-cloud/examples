import { Signal } from '@moq/signals';
import * as Publish from '@moq/publish';
import * as Watch from '@moq/watch';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { MoqConnectionStatus, MoqStream, TranslationOption } from '@/utils/types';
import { GOOGLE_PROVIDER, GOOGLE_TRANSLATION_LANGUAGES } from '@/utils/googleLanguages';
import { buildTranslationOption, compareTranslationOptions, parseTranslationPath } from '@/utils/translation';

type RemoteStream = {
  path: string;
  broadcast: Watch.Broadcast;
  cleanup: () => void;
};

type TranslationProvider = {
  path: string;
  sourcePath: string;
  provider: string;
  broadcast: Watch.Broadcast;
  cleanup: () => void;
};

/**
 * Core MoQ connection + broadcast discovery for a single stream. The viewer connects
 * straight to one broadcast path, so the relay announces exactly that stream plus its
 * translation broadcasts. Splits the announced paths into the stream broadcast and its
 * translation options, and exposes them as a single `stream`.
 */
export const useMoqConnection = () => {
  const [connectionStatus, setConnectionStatus] = useState<MoqConnectionStatus>('disconnected');
  const [hasSession, setHasSession] = useState(false);
  const [stream, setStream] = useState<MoqStream | undefined>(undefined);

  const [connectionSignal] = useState(() => new Signal<Publish.Lite.Connection.Established | undefined>(undefined));

  const reloadRef = useRef<Publish.Lite.Connection.Reload | null>(null);
  const sessionCleanupRef = useRef<(() => void) | null>(null);
  const streamRef = useRef<RemoteStream | null>(null);
  const translationProvidersRef = useRef(new Map<string, TranslationProvider>());

  const refreshStream = useCallback(() => {
    const current = streamRef.current;

    if (!current) {
      setStream(undefined);
      return;
    }

    const translations = new Map<string, TranslationOption>();

    for (const provider of translationProvidersRef.current.values()) {
      if (provider.sourcePath !== current.path || provider.provider.toLowerCase() !== GOOGLE_PROVIDER) {
        continue;
      }

      const activeLanguages = new Set(Object.keys(provider.broadcast.catalog.peek()?.audio?.renditions ?? {}));

      for (const language of activeLanguages) {
        const option = buildTranslationOption({
          provider: provider.provider,
          language,
          path: provider.path,
          trackName: language,
          status: 'active',
          broadcast: provider.broadcast,
        });
        translations.set(option.key, option);
      }

      for (const language of GOOGLE_TRANSLATION_LANGUAGES) {
        if (activeLanguages.has(language.code)) {
          continue;
        }

        const option = buildTranslationOption({
          provider: provider.provider,
          language: language.code,
          path: provider.path,
          trackName: language.code,
          status: 'requestable',
          broadcast: provider.broadcast,
        });
        translations.set(option.key, option);
      }
    }

    const catalog = current.broadcast.catalog.peek();
    const hasVideo = !!catalog?.video && Object.keys(catalog.video.renditions ?? {}).length > 0;

    setStream({
      path: current.path,
      hasVideo,
      broadcast: current.broadcast,
      translations: [...translations.values()].sort(compareTranslationOptions),
    });
  }, []);

  const removeStream = useCallback(() => {
    if (!streamRef.current) {
      return;
    }

    streamRef.current.cleanup();
    streamRef.current = null;
    refreshStream();
  }, [refreshStream]);

  const resetStream = useCallback(() => {
    streamRef.current?.cleanup();
    streamRef.current = null;

    for (const provider of translationProvidersRef.current.values()) {
      provider.cleanup();
    }

    translationProvidersRef.current.clear();
    setStream(undefined);
  }, []);

  const ensureStream = useCallback(
    (path: string) => {
      if (streamRef.current?.path === path) {
        return;
      }

      // A different stream replaced the previous one: tear the old broadcast down first.
      streamRef.current?.cleanup();

      const broadcast = new Watch.Broadcast({
        connection: connectionSignal,
        enabled: true,
        name: Publish.Lite.Path.from(path),
      });

      const sync = () => {
        refreshStream();
      };

      const disposeCatalog = broadcast.catalog.subscribe(sync);
      const disposeStatus = broadcast.status.subscribe(sync);

      streamRef.current = {
        path,
        broadcast,
        cleanup: () => {
          disposeCatalog();
          disposeStatus();
          broadcast.close();
        },
      };

      refreshStream();
    },
    [connectionSignal, refreshStream],
  );

  const ensureTranslationProvider = useCallback(
    (path: string, sourcePath: string, provider: string) => {
      if (translationProvidersRef.current.has(path)) {
        return;
      }

      const broadcast = new Watch.Broadcast({
        connection: connectionSignal,
        announced: reloadRef.current?.announced,
        enabled: true,
        name: Publish.Lite.Path.from(path),
        reload: true,
      });

      const sync = () => {
        refreshStream();
      };

      const disposeCatalog = broadcast.catalog.subscribe(sync);
      const disposeStatus = broadcast.status.subscribe(sync);

      translationProvidersRef.current.set(path, {
        path,
        sourcePath,
        provider,
        broadcast,
        cleanup: () => {
          disposeCatalog();
          disposeStatus();
          broadcast.close();
        },
      });

      refreshStream();
    },
    [connectionSignal, refreshStream],
  );

  const disconnect = useCallback(() => {
    sessionCleanupRef.current?.();
    sessionCleanupRef.current = null;
    reloadRef.current = null;
    connectionSignal.set(undefined);
    setConnectionStatus('disconnected');
    setHasSession(false);
    resetStream();
  }, [connectionSignal, resetStream]);

  const connect = useCallback(
    (connectionUrl: URL) => {
      disconnect();

      setHasSession(true);
      setConnectionStatus('connecting');

      const reload = new Publish.Lite.Connection.Reload({
        enabled: true,
        url: connectionUrl,
      });

      reloadRef.current = reload;

      const disposeStatus = reload.status.subscribe((value) => {
        setConnectionStatus(value);
      });

      const disposeEstablished = reload.established.subscribe((connection) => {
        connectionSignal.set(connection);
      });

      const syncStream = (announced: Set<Publish.Lite.Path.Valid>) => {
        let streamPath: string | undefined;
        const providerPaths = new Map<string, { sourcePath: string; provider: string }>();

        for (const announcedPath of announced) {
          const path = announcedPath.toString();

          const parsed = parseTranslationPath(path);
          if (parsed) {
            if (parsed.provider.toLowerCase() === GOOGLE_PROVIDER) {
              providerPaths.set(path, { sourcePath: parsed.sourcePath, provider: parsed.provider });
            }
            continue;
          }

          // The (single) stream broadcast — everything that isn't a translation provider.
          streamPath = path;
        }

        if (streamPath !== undefined) {
          ensureStream(streamPath);
        } else {
          removeStream();
        }

        for (const [path, { sourcePath, provider }] of providerPaths) {
          ensureTranslationProvider(path, sourcePath, provider);
        }

        for (const [path, provider] of translationProvidersRef.current) {
          if (!providerPaths.has(path)) {
            provider.cleanup();
            translationProvidersRef.current.delete(path);
          }
        }

        // Translations may change without the stream changing, so refresh unconditionally.
        refreshStream();
      };

      const disposeDiscovery = reload.announced.subscribe((announced) => {
        syncStream(announced);
      });

      syncStream(reload.announced.peek());

      sessionCleanupRef.current = () => {
        disposeDiscovery();
        disposeEstablished();
        disposeStatus();
        reload.close();
      };
    },
    [connectionSignal, disconnect, ensureStream, ensureTranslationProvider, refreshStream, removeStream],
  );

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    connection: connectionSignal,
    connectionStatus,
    stream: hasSession ? stream : undefined,
    connect,
    disconnect,
  };
};
