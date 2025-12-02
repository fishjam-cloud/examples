import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import {
	ClientTools,
	Conversation,
} from '@elevenlabs/elevenlabs-js/api/resources/conversationalAi/conversation/index.js';
import type { Story } from '../../types.js';
import {
	getFirstMessageForStory,
	getInstructionsForStory,
	getToolDescriptionForStory,
} from '../../utils.js';
import type { AgentConfig, VoiceAgentApi } from '../api.js';
import type { VoiceAgentSession } from '../session.js';
import { ForwardingAudioInterface } from './audioInterface.js';
import { ElevenLabsSession } from './session.js';

export class ElevenLabsApi implements VoiceAgentApi {
	private elevenLabs: ElevenLabsClient;

	constructor(apiKey: string) {
		this.elevenLabs = new ElevenLabsClient({ apiKey });
	}

	async createAgentSession(config: AgentConfig): Promise<VoiceAgentSession> {
		const story = config.story;
		const instructions = getInstructionsForStory(story);
		const firstMessage = getFirstMessageForStory(story);
		const endGameToolId = await this.ensureGameEndingTool(story);

		console.log(
			`Creating ElevenLabs agent for story "${story.title}" (ID: ${story.id})`,
		);

		const prompt = { prompt: instructions, toolIds: [endGameToolId] };

		const params = {
			conversationConfig: {
				conversation: {
					maxDurationSeconds: config.gameTimeLimitSeconds,
				},
				agent: {
					firstMessage,
					language: 'en',
					prompt,
				},
			},
		};

		const { agentId } =
			await this.elevenLabs.conversationalAi.agents.create(params);

		return await this.createElevenLabsSession(config, agentId);
	}

	private async createElevenLabsSession(config: AgentConfig, agentId: string) {
		const clientTools = new ClientTools();
		clientTools.register('endGame', (_) => config.onEndGame());

		const audioInterface = new ForwardingAudioInterface();

		const conversation = new Conversation({
			agentId,
			requiresAuth: false,
			audioInterface,
			clientTools,
			callbackAgentResponse: (response) => config.onTranscription(response),
		});

		return new ElevenLabsSession(audioInterface, conversation);
	}

	private async ensureGameEndingTool(story: Story): Promise<string> {
		const toolName = 'endGame';

		const toolDescription = getToolDescriptionForStory(story);

		const { tools: allTools } =
			await this.elevenLabs.conversationalAi.tools.list();
		const existingTool = allTools.find(
			({ toolConfig }) =>
				toolConfig.type === 'client' &&
				toolConfig.name === toolName &&
				toolConfig.description === toolDescription,
		);

		if (existingTool) return existingTool.id;

		const createdTool = await this.elevenLabs.conversationalAi.tools.create({
			toolConfig: {
				type: 'client',
				name: toolName,
				description: toolDescription,
			},
		});

		return createdTool.id;
	}
}
