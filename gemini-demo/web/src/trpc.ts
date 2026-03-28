import type { AppRouter } from "gemini-demo-backend";
import {
  createTRPCClient,
  httpBatchLink,
  splitLink,
  wsLink,
} from "@trpc/client";
import { createWSClient } from "@trpc/client";

const wsClient = createWSClient({
  url: `ws://${window.location.host}/api/v1`,
});

export const trpc = createTRPCClient<AppRouter>({
  links: [
    splitLink({
      condition: (op) => op.type === "subscription",
      true: wsLink({ client: wsClient }),
      false: httpBatchLink({ url: "/api/v1" }),
    }),
  ],
});
