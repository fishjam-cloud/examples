import { useSandbox } from "@fishjam-cloud/react-client";
import { useCallback } from "react";

import { SANDBOX_API_URL } from "@/config";

const tokenStreamName = (streamName: string) => streamName;

/**
 * Wraps `useSandbox` to fetch a MoQ relay connection URL for a stream. The sandbox returns a
 * full relay URL (including the Fishjam ID) with the JWT embedded as `?jwt=<token>`, scoped to
 * the given role.
 */
export const useMoqTokens = () => {
  const { getSandboxMoqPublisherAccess, getSandboxMoqSubscriberAccess } =
    useSandbox({
      sandboxApiUrl: SANDBOX_API_URL ?? "",
    });

  const authorizeConnection = useCallback(
    async (streamName: string, role: "publisher" | "subscriber") => {
      if (!SANDBOX_API_URL) {
        throw new Error(
          "VITE_SANDBOX_API_URL is not set — required to fetch a MoQ connection URL (see .env.example).",
        );
      }

      const { connectionUrl } =
        role === "publisher"
          ? await getSandboxMoqPublisherAccess(tokenStreamName(streamName))
          : await getSandboxMoqSubscriberAccess(tokenStreamName(streamName));

      return new URL(connectionUrl);
    },
    [getSandboxMoqPublisherAccess, getSandboxMoqSubscriberAccess],
  );

  return { authorizeConnection };
};
