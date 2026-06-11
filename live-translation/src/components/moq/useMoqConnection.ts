import { Signal } from '@moq/signals';
import * as Publish from '@moq/publish';
import * as Watch from '@moq/watch';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { MoqConnectionStatus, MoqTile, TranslationOption } from './types';
import {
  buildTranslationOption,
  formatTileName,
  isScreensharePath,
  parseTranslationPath,
  prettyPeerName,
} from './utils';

type RemoteParticipant = {
  path: string;
  broadcast: Watch.Broadcast;
  cleanup: () => void;
};

/**
 * Core MoQ connection + broadcast discovery, independent of how the connection URL is
 * chosen. Subscribes to the relay's announced paths, splits them into participant
 * broadcasts and translation options, and exposes them as `tiles`.
 *
 * `useMoqRoom` wraps this with the join-room form (building the URL from a room name and
 * navigating); the publisher's QR viewer wraps it by connecting straight to a single
 * broadcast path so only that stream and its translations are discovered.
 */
export const useMoqConnection = () => {
  const [connectionStatus, setConnectionStatus] = useState<MoqConnectionStatus>('disconnected');
  const [hasSession, setHasSession] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remoteTiles, setRemoteTiles] = useState<MoqTile[]>([]);

  const [connectionSignal] = useState(() => new Signal<Publish.Lite.Connection.Established | undefined>(undefined));

  const reloadRef = useRef<Publish.Lite.Connection.Reload | null>(null);
  const sessionCleanupRef = useRef<(() => void) | null>(null);
  const participantsRef = useRef(new Map<string, RemoteParticipant>());
  // Maps a source broadcast path to its available translation options, keyed by option key.
  const translationsRef = useRef(new Map<string, Map<string, TranslationOption>>());

  const refreshRemoteTiles = useCallback(() => {
    setRemoteTiles(
      [...participantsRef.current.values()]
        .map(({ path, broadcast }) => {
          const catalog = broadcast.catalog.peek();
          const hasCatalogVideo = !!catalog?.video && Object.keys(catalog.video.renditions ?? {}).length > 0;
          const hasCatalogAudio = !!catalog?.audio && Object.keys(catalog.audio.renditions ?? {}).length > 0;
          const type = isScreensharePath(path) ? ('screenshare' as const) : ('video' as const);
          const name = formatTileName(prettyPeerName(path), type);
          const translations = [...(translationsRef.current.get(path)?.values() ?? [])].sort((left, right) =>
            left.label.localeCompare(right.label),
          );

          return {
            peerId: path,
            type,
            name,
            local: false,
            isMuted: type === 'video' ? !hasCatalogAudio : false,
            hasVideo: hasCatalogVideo,
            broadcast,
            translations,
          };
        })
        .sort((left, right) => (left.name ?? '').localeCompare(right.name ?? '')),
    );
  }, []);

  const removeParticipant = useCallback(
    (path: string) => {
      const participant = participantsRef.current.get(path);
      if (!participant) {
        return;
      }

      participant.cleanup();
      participantsRef.current.delete(path);
      refreshRemoteTiles();
    },
    [refreshRemoteTiles],
  );

  const resetParticipants = useCallback(() => {
    for (const participant of participantsRef.current.values()) {
      participant.cleanup();
    }

    participantsRef.current.clear();
    translationsRef.current.clear();
    setRemoteTiles([]);
  }, []);

  const ensureParticipant = useCallback(
    (path: string) => {
      if (participantsRef.current.has(path)) {
        return;
      }

      const broadcast = new Watch.Broadcast({
        connection: connectionSignal,
        enabled: true,
        name: Publish.Lite.Path.from(path),
      });

      const sync = () => {
        refreshRemoteTiles();
      };

      const cleanup = () => {
        disposeCatalog();
        disposeStatus();
        broadcast.close();
      };

      const disposeCatalog = broadcast.catalog.subscribe(sync);
      const disposeStatus = broadcast.status.subscribe(sync);

      participantsRef.current.set(path, {
        path,
        broadcast,
        cleanup,
      });

      refreshRemoteTiles();
    },
    [connectionSignal, refreshRemoteTiles],
  );

  const disconnect = useCallback(() => {
    sessionCleanupRef.current?.();
    sessionCleanupRef.current = null;
    reloadRef.current = null;
    connectionSignal.set(undefined);
    setConnectionStatus('disconnected');
    setHasSession(false);
    setError(null);
    resetParticipants();
  }, [connectionSignal, resetParticipants]);

  const connect = useCallback(
    (connectionUrl: URL) => {
      disconnect();

      setHasSession(true);
      setConnectionStatus('connecting');
      setError(null);

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

      const syncParticipants = (announced: Set<Publish.Lite.Path.Valid>) => {
        const participantPaths = new Set<string>();
        const translationsBySource = new Map<string, Map<string, TranslationOption>>();

        for (const announcedPath of announced) {
          const path = announcedPath.toString();

          const parsed = parseTranslationPath(path);
          if (parsed) {
            const option = buildTranslationOption(parsed, path);
            let group = translationsBySource.get(parsed.sourcePath);
            if (!group) {
              group = new Map();
              translationsBySource.set(parsed.sourcePath, group);
            }
            group.set(option.key, option);
            continue;
          }

          participantPaths.add(path);
        }

        translationsRef.current = translationsBySource;

        for (const path of participantPaths) {
          ensureParticipant(path);
        }

        for (const path of participantsRef.current.keys()) {
          if (!participantPaths.has(path)) {
            removeParticipant(path);
          }
        }

        // Translations may change without participants changing, so refresh tiles unconditionally.
        refreshRemoteTiles();
      };

      const disposeDiscovery = reload.announced.subscribe((announced) => {
        syncParticipants(announced);
      });

      syncParticipants(reload.announced.peek());

      sessionCleanupRef.current = () => {
        disposeDiscovery();
        disposeEstablished();
        disposeStatus();
        reload.close();
      };
    },
    [connectionSignal, disconnect, ensureParticipant, refreshRemoteTiles, removeParticipant],
  );

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  const tiles = useMemo(() => (hasSession ? remoteTiles : []), [remoteTiles, hasSession]);

  return {
    connection: connectionSignal,
    connectionStatus,
    error,
    hasSession,
    tiles,
    connect,
    disconnect,
    setError,
  };
};
