import type { RoomId } from '@fishjam-cloud/js-server-sdk';
import {
	elevenLabs,
	ElevenLabsConversation,
} from './elevenlabs-conversation.js';
import { roomService } from './room.js';
import { getInstructionsForStory } from '../utils.js';
import { AGENT_CLIENT_TOOL_INSTRUCTIONS, CONFIG } from '../config.js';
import type { Story } from '../types.js';
import {
	GameSessionNotFoundError,
	StoryNotFoundError,
} from '../domain/errors.js';
import { notifierService } from './notifier.js';

export class ElevenLabsSessionManager {
	private session: ElevenLabsConversation | null = null;
	private endingRoom: boolean = false;
	private gameEndingToolId: string | undefined;
	private agentId: string | undefined;
	private roomId: RoomId;

	constructor(roomId: RoomId) {
		this.roomId = roomId;
	}

	async init() {
		const toolId = await this.ensureGameEndingTool();

		const story = await this.resolveStory(this.roomId);

		this.agentId = await this.createAgent(story, toolId);

		this.session = new ElevenLabsConversation(
			this.agentId,
			CONFIG.ELEVENLABS_API_KEY,
		);
		await this.session.connect();
		this.registerClientToolHandler(this.session, this.roomId);

		this.session.on('agentResponse', (event: { agent_response?: string }) => {
			if (event.agent_response) {
				console.log('Agent response event:', event.agent_response);
				const transcriptionEvent = {
					type: 'transcription' as const,
					text: event.agent_response,
					timestamp: Date.now(),
				};
				notifierService.emitNotification(this.roomId, transcriptionEvent);
			}
		});
	}

	private async createAgent(story: Story, toolId: string): Promise<string> {
		const instructions = getInstructionsForStory(story);

		console.log(
			`Creating ElevenLabs agent for story "${story.title}" (ID: ${story.id})`,
		);

		const prompt = { prompt: instructions, toolIds: [toolId] };

		const config = {
			conversationConfig: {
				agent: {
					firstMessage: `Welcome to deep-sea-stories!`,
					language: 'en',
					prompt,
				},
			},
		};

		const { agentId } = await elevenLabs.conversationalAi.agents.create(config);
		return agentId;
	}

	private async ensureGameEndingTool(): Promise<string> {
		if (this.gameEndingToolId) {
			return this.gameEndingToolId;
		}

		const tools = await elevenLabs.conversationalAi.tools.list();
		const existingTool = (tools.tools ?? []).find(
			(tool) =>
				tool.toolConfig.type === 'client' &&
				tool.toolConfig.name === 'game-ending',
		);

		if (existingTool?.id) {
			this.gameEndingToolId = existingTool.id;
			return this.gameEndingToolId;
		}

		const createdTool = await elevenLabs.conversationalAi.tools.create({
			toolConfig: {
				type: 'client',
				name: 'game-ending',
				description: AGENT_CLIENT_TOOL_INSTRUCTIONS,
			},
		});

		this.gameEndingToolId = createdTool.id;
		return this.gameEndingToolId;
	}

	private registerClientToolHandler(
		session: ElevenLabsConversation,
		roomId: RoomId,
	): void {
		session.on('clientToolCall', async (clientToolCall: unknown) => {
			const call =
				clientToolCall && typeof clientToolCall === 'object'
					? (clientToolCall as Record<string, unknown>)
					: undefined;
			const toolName =
				typeof call?.tool_name === 'string' ? call.tool_name : undefined;
			if (!toolName || toolName !== 'game-ending') {
				return;
			}
			if (this.endingRoom) {
				return;
			}

			this.endingRoom = true;

			const gameSession = roomService.getGameSession(roomId);

			if (!gameSession) {
				console.warn(
					`Received game-ending tool call for room ${roomId} without active game session`,
				);
				this.endingRoom = false;
				return;
			}

			if (!roomService.isGameActive(roomId)) {
				this.endingRoom = false;
				return;
			}

			try {
				await gameSession.stopGame();
				console.log(
					`Game session for room ${roomId} ended after game-ending tool call `,
				);
			} catch (error) {
				console.error(
					`Failed to stop game for room ${roomId} after game-ending tool call `,
					error,
				);
			} finally {
				this.endingRoom = false;
			}
		});
	}

	getSession(): ElevenLabsConversation | null {
		return this.session;
	}

	async deleteSession(): Promise<void> {
		const agentId = this.agentId;

		if (this.session) {
			try {
				await this.session.disconnect();
			} catch (error) {
				console.error(`Error closing session `, error);
			}
		}

		if (agentId) {
			try {
				await elevenLabs.conversationalAi.agents.delete(agentId);
				console.log(`Deleted ElevenLabs agent ${agentId} `);
			} catch (error) {
				console.error(`Error deleting ElevenLabs agent ${agentId} `, error);
			}
		}
	}

	private async resolveStory(roomId: RoomId) {
		const gameSession = roomService.getGameSession(roomId);
		if (!gameSession) {
			throw new GameSessionNotFoundError(roomId);
		}

		const story = gameSession.getStory();
		if (!story) {
			throw new StoryNotFoundError(roomId);
		}

		return story;
	}
}
