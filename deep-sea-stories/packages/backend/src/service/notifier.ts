import { FishjamWSNotifier, FishjamConfig } from "@fishjam-cloud/js-server-sdk";
import { RealtimeSession } from "@openai/agents-realtime";
import { getRealtimeAgent } from "./agent.js";

export async function getNotifier(session: RealtimeSession, config: FishjamConfig): Promise<FishjamWSNotifier> {
  const notifier = new FishjamWSNotifier(config, () => { }, () => { });

  notifier.on('peerConnected', () => {
    const agent = getRealtimeAgent();
    const session = new RealtimeSession(agent);
    session.sendMessage("start");
  });
  return notifier;
}
