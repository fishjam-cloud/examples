import cors from "@fastify/cors";

import {
  type FastifyTRPCPluginOptions,
  fastifyTRPCPlugin,
} from "@trpc/server/adapters/fastify";
import { applyWSSHandler } from "@trpc/server/adapters/ws";
import Fastify from "fastify";
import { WebSocketServer } from "ws";
import { type AppRouter, appRouter } from "./router.js";
export type { AppRouter } from "./router.js";
import config from "./config.js";

const fastify = Fastify({
  logger: { transport: { target: "pino-pretty" } },
});

await fastify.register(cors, { origin: true, credentials: true });

fastify.register(fastifyTRPCPlugin, {
  prefix: "/api/v1",
  trpcOptions: {
    router: appRouter,
    onError({ path, error }) {
      fastify.log.error("tRPC error on %s: %O", path, error);
    },
  } satisfies FastifyTRPCPluginOptions<AppRouter>["trpcOptions"],
});

await fastify.ready();
await fastify.listen({ port: config.PORT, host: "0.0.0.0" });

const wss = new WebSocketServer({
  server: fastify.server,
  path: "/api/v1",
});

applyWSSHandler({ wss, router: appRouter });

fastify.log.info(`Server running on port ${config.PORT}`);
