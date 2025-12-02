import type { Story } from '../types.js';
import type { VoiceAgentSession } from './session.js';

export interface AgentConfig {
	story: Story;
	onEndGame: () => Promise<void>;
	gameTimeLimitSeconds: number;
	onTranscription: (transcription: string) => void;
}

export interface VoiceAgentApi {
	createAgentSession: (config: AgentConfig) => Promise<VoiceAgentSession>;
}
