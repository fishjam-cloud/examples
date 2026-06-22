import { useSandbox } from "@fishjam-cloud/react-client";
import { useCallback } from "react";

import { SANDBOX_API_URL } from "@/config";

const tokenStreamName = (streamName: string) => streamName;

/**
 * Wraps `useSandbox` to authorize a MoQ relay connection URL. Returns a function that, given
 * a connection URL and the stream name, fetches a Fishjam sandbox JWT and appends it as
 * `?jwt=<token>`.
 */
export const useMoqTokens = () => {
  const { getSandboxMoqPublisherToken, getSandboxMoqSubscriberToken } =
    useSandbox({
      sandboxApiUrl: SANDBOX_API_URL ?? "",
    });

  const authorizeConnection = useCallback(
    async (url: URL, streamName: string, role: "publisher" | "subscriber") => {
      if (!SANDBOX_API_URL) {
        throw new Error(
          "VITE_SANDBOX_API_URL is not set — required to fetch a MoQ token (see .env.example).",
        );
      }

      const token =
        role === "publisher"
          ? await getSandboxMoqPublisherToken(tokenStreamName(streamName))
          : await getSandboxMoqSubscriberToken(tokenStreamName(streamName));

      const authorized = new URL(url);
      authorized.searchParams.set("jwt", token);
      return authorized;
    },
    [getSandboxMoqPublisherToken, getSandboxMoqSubscriberToken],
  );

  return { authorizeConnection };
};
