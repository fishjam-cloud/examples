import { initTRPC } from "@trpc/server";
import z from "zod";
import { getPeerToken } from "./peers.js";
import { createAgent } from "./agents.js";
import type { RoomId } from "@fishjam-cloud/js-server-sdk";

const t = initTRPC.create();

export const appRouter = t.router({
  getPeerToken: t.procedure
    .input(z.object({ roomName: z.string().min(1), peerName: z.string() }))
    .mutation(async ({ input }) =>
      getPeerToken(input.roomName, input.peerName),
    ),
  createAgent: t.procedure
    .input(z.object({ roomId: z.string(), systemPrompt: z.string().min(1) }))
    .mutation(async ({ input }) =>
      createAgent(input.roomId as RoomId, input.systemPrompt),
    ),
});

export type AppRouter = typeof appRouter;
