import { GoogleGenAI } from '@google/genai';
import type { AgentConfig, VoiceAgentApi } from '../api.js';
import type { VoiceAgentSession } from '../session.js';
import { GeminiSession } from './session.js';

export class GeminiApi implements VoiceAgentApi {
	private genai: GoogleGenAI;

	constructor(apiKey: string) {
		this.genai = new GoogleGenAI({ apiKey });
	}

	async createAgentSession(config: AgentConfig): Promise<VoiceAgentSession> {
		const story = config.story;

		console.log(
			`Creating Gemini agent for story "${story.title}" (ID: ${story.id})`,
		);

		return new GeminiSession(this.genai, config);
	}
}
