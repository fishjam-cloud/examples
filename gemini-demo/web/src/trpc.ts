import type { AppRouter } from "gemini-demo-backend";
import { createTRPCClient, httpBatchLink } from "@trpc/client";

export const trpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: "/api/v1",
    }),
  ],
});
