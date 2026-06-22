import { useEffect } from "react";
import { toast } from "sonner";

import { useMoqConnection } from "@/hooks/useMoqConnection";
import { useMoqTokens } from "@/hooks/useMoqTokens";
import { buildConnectionUrl } from "@/utils/translation";

// Watches a single published stream (and its translations). The connection goes to the Fishjam
// root; the subscriber token is scoped to this stream name, so the relay only announces that
// stream plus its translations. Connects once `enabled` is true (gated behind a user gesture so
// the browser lets the audio AudioContext start) and reconnects if the stream name changes.
export const useMoqStreamViewer = (
  streamName: string | undefined,
  enabled = true,
) => {
  const { connect, disconnect, ...rest } = useMoqConnection();
  const { authorizeConnection } = useMoqTokens();

  useEffect(() => {
    if (!streamName || !enabled) {
      return;
    }

    // A subscriber token must be fetched before connecting, so the connect is async. Guard
    // against the effect being torn down (stream change / unmount) mid-fetch.
    let cancelled = false;

    void (async () => {
      try {
        const url = await authorizeConnection(
          buildConnectionUrl(),
          streamName,
          "subscriber",
        );
        if (!cancelled) {
          connect(url);
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(
            "Could not join the stream — failed to fetch a MoQ token.",
          );
        }
        console.error(error);
      }
    })();

    return () => {
      cancelled = true;
      disconnect();
    };
  }, [streamName, enabled, connect, disconnect, authorizeConnection]);

  return rest;
};
