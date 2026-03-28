import { LiveServerMessage, Modality } from "@google/genai";
import * as FishjamGemini from "@fishjam-cloud/js-server-sdk/gemini";
import { type TrackId, type RoomId } from "@fishjam-cloud/js-server-sdk";

import { fishjam, genai } from "./clients.js";

export const createAgent = async (
  roomId: RoomId,
  systemInstruction: string,
) => {
  const { agent: fishjamAgent } = await fishjam.createAgent(roomId, {
    output: FishjamGemini.geminiInputAudioSettings,
  });

  const agentTrack = fishjamAgent.createTrack(
    FishjamGemini.geminiOutputAudioSettings,
  );

  let cleanup: CallableFunction | undefined;

  const session = await genai.live.connect({
    model: "gemini-3.1-flash-live-preview",
    config: {
      responseModalities: [Modality.AUDIO],
      systemInstruction,
      tools: [
        { googleSearch: {} },
        {
          functionDeclarations: [
            {
              name: "disconnect",
              description: `Disconnect yourself from the room. 
                            Use this when the user asks you to disconnect.`,
            },
          ],
        },
      ],
    },
    callbacks: {
      onmessage: async (message: LiveServerMessage) => {
        if (message.data) {
          const audio = Buffer.from(message.data, "base64");
          fishjamAgent.sendData(agentTrack.id, audio);
        }

        if (message.serverContent?.interrupted) {
          fishjamAgent.interruptTrack(agentTrack.id);
        }

        message.toolCall?.functionCalls?.forEach((call) => {
          if (call.name === "disconnect") {
            cleanup?.();
          }
        });
      },
    },
  });

  const room = await fishjam.getRoom(roomId);

  const interval = setInterval(async () => {
    const humanPeerVideoTrack = room.peers
      .find(({ type }) => type === "webrtc")
      ?.tracks.find(({ type }) => type === "video");

    if (!humanPeerVideoTrack?.id) return;

    const image = await fishjamAgent.captureImage(
      humanPeerVideoTrack.id as TrackId,
    );

    session.sendRealtimeInput({
      video: {
        data: Buffer.from(image.data).toString("base64"),
        mimeType: image.contentType,
      },
    });
  }, 1000);

  fishjamAgent.on("trackData", ({ data }) => {
    session.sendRealtimeInput({
      audio: {
        data: Buffer.from(data).toString("base64"),
        mimeType: FishjamGemini.inputMimeType,
      },
    });
  });

  cleanup = () => {
    clearInterval(interval);
    session.close();
    fishjamAgent.deleteTrack(agentTrack.id);
    fishjamAgent.removeAllListeners("trackData");
    fishjamAgent.disconnect();
  };
};
