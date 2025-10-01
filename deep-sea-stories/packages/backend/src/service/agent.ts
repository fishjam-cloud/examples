import { RealtimeAgent } from "@openai/agents-realtime";
import { AGENT_INSTRUCTIONS } from "../config.js";

export function getRealtimeAgent(): RealtimeAgent {
  return new RealtimeAgent({
    name: 'Riddle Master',
    instructions: AGENT_INSTRUCTIONS
  })
}
