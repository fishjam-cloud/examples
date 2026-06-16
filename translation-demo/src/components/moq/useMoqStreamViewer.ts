import { useEffect } from 'react';

import { useMoqConnection } from './useMoqConnection';
import { buildStreamConnectionUrl } from './utils';

// Watches a single published stream (and its translations) by connecting straight to its
// broadcast path. Connects once `enabled` is true (gated behind a user gesture so the
// browser lets the audio AudioContext start) and reconnects if the stream name changes.
export const useMoqStreamViewer = (streamName: string | undefined, enabled = true) => {
  const { connect, disconnect, ...rest } = useMoqConnection();

  useEffect(() => {
    if (!streamName || !enabled) {
      return;
    }

    connect(buildStreamConnectionUrl(streamName));

    return () => {
      disconnect();
    };
  }, [streamName, enabled, connect, disconnect]);

  return rest;
};
