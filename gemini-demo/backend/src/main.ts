import cors from "@fastify/cors";
import {
  FishjamClient,
  TrackId,
  type RoomId,
} from "@fishjam-cloud/js-server-sdk";
import * as FishjamGemini from "@fishjam-cloud/js-server-sdk/gemini";
import {
  Modality,
  type FunctionDeclaration,
  type LiveServerMessage,
  type Session,
} from "@google/genai";

import {
  type FastifyTRPCPluginOptions,
  fastifyTRPCPlugin,
} from "@trpc/server/adapters/fastify";
import { applyWSSHandler } from "@trpc/server/adapters/ws";
import { initTRPC } from "@trpc/server";
import { observable } from "@trpc/server/observable";
import dotenv from "dotenv";
import { EventEmitter } from "node:events";
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

const genai = FishjamGemini.createClient({
  apiKey: config.GEMINI_API_KEY,
});

// --- Per-room agent state ---

type AgentState = {
  session: Session;
  fishjamAgent: Awaited<ReturnType<typeof fishjam.createAgent>>["agent"];
  cleanup: () => void;
};

const agents = new Map<string, AgentState>();

// Room name -> roomId mapping
const roomsByName = new Map<string, string>();

// Event emitter for streaming captured images to the frontend
const imageEvents = new EventEmitter();

// --- tRPC ---
const t = initTRPC.create();

const appRouter = t.router({
  joinOrCreateRoom: t.procedure
    .input(z.object({ roomName: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const existingRoomId = roomsByName.get(input.roomName);
      if (existingRoomId) {
        return { id: existingRoomId, created: false };
      }
      const room = await fishjam.createRoom();
      roomsByName.set(input.roomName, room.id);
      return { id: room.id, created: true };
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
          {
            output: FishjamGemini.geminiInputAudioSettings,
          },
          {
            onError: (event: Event) => {
              console.error("Fishjam agent error:", event);
            },
          },
        );

      // Create an audio track for the agent to send audio to peers
      const agentTrack = fishjamAgent.createTrack(
        FishjamGemini.geminiOutputAudioSettings,
      );

      const captureImageDeclaration: FunctionDeclaration = {
        name: "capture_image",
        description:
          "Capture an image from the user's camera. Use this when the user asks you to capture his camera..",
      };

      // Connect to Gemini Live API
      const session = await genai.live.connect({
        model: GEMINI_MODEL,
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: input.systemPrompt,
          tools: [
            { googleSearch: {} },
            { functionDeclarations: [captureImageDeclaration] },
          ],
        },
        callbacks: {
          onmessage: async (message: LiveServerMessage) => {
            // Forward agent audio to Fishjam
            if (message.data) {
              const audio = Buffer.from(message.data, "base64");
              fishjamAgent.sendData(agentTrack.id, audio);
            }

            if (message.serverContent?.interrupted) {
              fishjamAgent.interruptTrack(agentTrack.id);
            }

            // Handle Gemini function calls (e.g. capture_image)
            if (message.toolCall?.functionCalls) {
              for (const fc of message.toolCall.functionCalls) {
                if (fc.name === "capture_image") {
                  // Capture a frame from each video track the agent is subscribed to
                  //
                  const room = await fishjam.getRoom(input.roomId as RoomId);

                  for (const track of room.peers.find(
                    (e) => e.type === "webrtc",
                  )?.tracks ?? []) {
                    fishjamAgent.captureImage(track.id as TrackId);
                  }

                  session.sendToolResponse({
                    functionResponses: {
                      id: fc.id!,
                      name: fc.name,
                      response: {
                        output:
                          "Image capture requested. The image will be sent shortly.",
                      },
                    },
                  });
                }
              }
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

      fishjamAgent.on("trackData", ({ track, data }) => {
        session.sendRealtimeInput({
          audio: {
            data: Buffer.from(data).toString("base64"),
            mimeType: "audio/pcm;rate=16000",
          },
        });
      });

      // Forward captured images to Gemini and emit for frontend preview
      fishjamAgent.on("trackImage", ({ contentType, data }) => {
        const base64 = Buffer.from(data).toString("base64");

        session.sendRealtimeInput({
          video: { data: base64, mimeType: contentType },
        });

        imageEvents.emit(`image:${input.roomId}`, {
          dataUrl: `data:${contentType};base64,${base64}`,
        });
      });

      const cleanup = () => {
        session.close();
        fishjamAgent.removeAllListeners("trackData");
        fishjamAgent.removeAllListeners("trackImage");
        fishjamAgent.deleteTrack(agentTrack.id);
        agents.delete(input.roomId);
      };

      agents.set(input.roomId, { session, fishjamAgent, cleanup });

      return { agentPeerId: agentPeer.id };
    }),

  onImageCapture: t.procedure
    .input(z.object({ roomId: z.string() }))
    .subscription(({ input }) => {
      return observable<{ dataUrl: string }>((emit) => {
        const handler = (data: { dataUrl: string }) => emit.next(data);
        imageEvents.on(`image:${input.roomId}`, handler);
        return () => {
          imageEvents.off(`image:${input.roomId}`, handler);
        };
      });
    }),

  captureImage: t.procedure
    .input(z.object({ roomId: z.string(), trackId: z.string() }))
    .mutation(async ({ input }) => {
      const agent = agents.get(input.roomId);
      if (!agent) {
        throw new Error("No agent exists for this room");
      }

      agent.fishjamAgent.captureImage(input.trackId as TrackId);

      return { success: true };
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
