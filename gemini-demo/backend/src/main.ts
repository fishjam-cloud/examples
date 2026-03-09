import cors from "@fastify/cors";
import { FishjamClient, type RoomId } from "@fishjam-cloud/js-server-sdk";
import {
  GoogleGenAI,
  Modality,
  type LiveServerMessage,
  type Session,
} from "@google/genai";
import {
  type FastifyTRPCPluginOptions,
  fastifyTRPCPlugin,
} from "@trpc/server/adapters/fastify";
import { applyWSSHandler } from "@trpc/server/adapters/ws";
import { initTRPC } from "@trpc/server";
import dotenv from "dotenv";
import Fastify from "fastify";
import { WebSocketServer } from "ws";
import z from "zod";

dotenv.config({ path: "../.env", quiet: true });

const config = z
  .object({
    PORT: z.coerce.number().int().default(8000),
    FISHJAM_ID: z.string(),
    FISHJAM_MANAGEMENT_TOKEN: z.string(),
    GEMINI_API_KEY: z.string(),
  })
  .parse(process.env);

const fishjam = new FishjamClient({
  fishjamId: config.FISHJAM_ID,
  managementToken: config.FISHJAM_MANAGEMENT_TOKEN,
});

const GEMINI_MODEL = "gemini-3.1-flash-audio-eap";
const genai = new GoogleGenAI({
  apiKey: config.GEMINI_API_KEY,
});

// --- Per-room agent state ---

type AgentState = {
  session: Session;
  cleanup: () => void;
};

const agents = new Map<string, AgentState>();

// --- tRPC ---

const t = initTRPC.create();

const appRouter = t.router({
  createRoom: t.procedure.mutation(async () => {
    return await fishjam.createRoom();
  }),

  createPeer: t.procedure
    .input(z.object({ roomId: z.string(), name: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const { peer, peerToken } = await fishjam.createPeer(
        input.roomId as RoomId,
      );
      return { peer, token: peerToken };
    }),

  createAgent: t.procedure
    .input(z.object({ roomId: z.string(), systemPrompt: z.string().min(1) }))
    .mutation(async ({ input }) => {
      if (agents.has(input.roomId)) {
        throw new Error("Agent already exists for this room");
      }

      // Create Fishjam agent (audio sink/source in the room)
      const { agent: fishjamAgent, peer: agentPeer } =
        await fishjam.createAgent(
          input.roomId as RoomId,
          { output: { audioSampleRate: 16_000 } },
          {
            onError: (event: Event) => {
              console.error("Fishjam agent error:", event);
            },
          },
        );

      // Wait for agent to be ready
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Create an audio track for the agent to send audio to peers
      const agentTrack = fishjamAgent.createTrack({
        channels: 1,
        sampleRate: 24000,
        encoding: "pcm16",
      });

      // Connect to Gemini Live API
      const session = await genai.live.connect({
        model: GEMINI_MODEL,
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: input.systemPrompt,
          tools: [{ googleSearch: {} }],
        },
        callbacks: {
          onmessage: (message: LiveServerMessage) => {
            // Forward agent audio to Fishjam
            if (message.data) {
              const audio = Buffer.from(message.data, "base64");
              fishjamAgent.sendData(agentTrack.id, audio);
            }

            if (message.serverContent?.interrupted) {
              fishjamAgent.interruptTrack(agentTrack.id);
            }
          },
          onerror: (e) => console.error("Gemini error:", e),
          onclose: (e) => {
            if (e.code !== 1000) {
              console.error("Gemini closed unexpectedly:", e.code, e.reason);
            }
          },
        },
      });

      // Forward peer audio to Gemini
      fishjamAgent.on("trackData", ({ data }) => {
        session.sendRealtimeInput({
          audio: {
            data: Buffer.from(data).toString("base64"),
            mimeType: "audio/pcm;rate=16000",
          },
        });
      });

      const cleanup = () => {
        session.close();
        fishjamAgent.removeAllListeners("trackData");
        fishjamAgent.deleteTrack(agentTrack.id);
        agents.delete(input.roomId);
      };

      agents.set(input.roomId, { session, cleanup });

      // Prompt the agent to introduce itself
      session.sendClientContent({
        turns: [{ text: "introduce yourself briefly" }],
        turnComplete: true,
      });

      return { agentPeerId: agentPeer.id };
    }),

  removeAgent: t.procedure
    .input(z.object({ roomId: z.string() }))
    .mutation(async ({ input }) => {
      const agent = agents.get(input.roomId);
      if (agent) {
        agent.cleanup();
      }
      return { success: true };
    }),
});

export type AppRouter = typeof appRouter;

// --- Server ---

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
