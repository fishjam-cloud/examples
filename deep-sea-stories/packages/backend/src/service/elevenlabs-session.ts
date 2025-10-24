import type { RoomId, PeerId } from '@fishjam-cloud/js-server-sdk';
import {
	elevenLabs,
	ElevenLabsConversation,
} from './elevenlabs-conversation.js';
import { roomService } from './room.js';
import {
	getInstructionsForStory,
	getMasterInstructionsForStory,
} from '../utils.js';
import { AGENT_CLIENT_TOOL_INSTRUCTIONS, CONFIG } from '../config.js';
import type { Story, VoiceAgentSessionManager } from '../types.js';
import {
	GameSessionNotFoundError,
	StoryNotFoundError,
} from '../domain/errors.js';

export class ElevenLabsSessionManager implements VoiceAgentSessionManager {
	private sessions = new Map<PeerId, ElevenLabsConversation>();
	private inFlightCreations = new Map<
		PeerId,
		Promise<ElevenLabsConversation>
	>();
	private endingRooms = new Set<RoomId>();
	private gameEndingToolId: string | undefined;
	private peerToAgentId = new Map<PeerId, string>();
	private hasMasterAgent = false;

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

	async createSession(
		peerId: PeerId,
		roomId: RoomId,
	): Promise<ElevenLabsConversation> {
		if (this.inFlightCreations.has(peerId)) {
			return this.inFlightCreations.get(
				peerId,
			) as Promise<ElevenLabsConversation>;
		}

		const promise = this._createSessionInternal(peerId, roomId).finally(() =>
			this.inFlightCreations.delete(peerId),
		);

		this.inFlightCreations.set(peerId, promise);
		return promise;
	}

	private async _createSessionInternal(
		peerId: PeerId,
		roomId: RoomId,
	): Promise<ElevenLabsConversation> {
		await this.deleteSession(peerId);

		const toolId = await this.ensureGameEndingTool();

		const story = await this.resolveStory(roomId);

		const agentId = await this.createAgent(story, toolId);

		const session = new ElevenLabsConversation(
			agentId,
			CONFIG.ELEVENLABS_API_KEY,
		);
		await session.connect();
		this.registerClientToolHandler(session, peerId, roomId);

		this.sessions.set(peerId, session);
		this.peerToAgentId.set(peerId, agentId);
		return session;
	}

	private async createAgent(
		story: Story,
		toolId: string | undefined,
	): Promise<string> {
		const isFirstAgent = !this.hasMasterAgent;
		if (isFirstAgent) {
			this.hasMasterAgent = true;
		}
		
		const instructions = isFirstAgent
			? getMasterInstructionsForStory(story)
			: getInstructionsForStory(story);

		console.log(
			isFirstAgent
				? 'Creating first ElevenLabs agent'
				: `Creating ElevenLabs agent for story "${story.title}" (ID: ${story.id})`,
		);

		const prompt = toolId
			? { prompt: instructions, toolIds: [toolId] }
			: { prompt: instructions };

		const config = {
			conversationConfig: {
				agent: {
					language: 'en' as const,
					prompt,
					...(isFirstAgent && { firstMessage: 'Welcome to Deepsea stories' }),
				},
			},
		};

		const { agentId } = await elevenLabs.conversationalAi.agents.create(config);
		return agentId;
	}

	private async ensureGameEndingTool(): Promise<string | undefined> {
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
		peerId: PeerId,
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

			if (this.endingRooms.has(roomId)) {
				return;
			}
			this.endingRooms.add(roomId);

			const gameSession = roomService.getGameSession(roomId);

			if (!gameSession) {
				console.warn(
					`Received game-ending tool call for room ${roomId} without active game session`,
				);
				this.endingRooms.delete(roomId);
				return;
			}

			if (!roomService.isGameActive(roomId)) {
				this.endingRooms.delete(roomId);
				return;
			}

			try {
				await gameSession.stopGame();
				console.log(
					`Game session for room ${roomId} ended after game-ending tool call from peer ${peerId}`,
				);
			} catch (error) {
				console.error(
					`Failed to stop game for room ${roomId} after game-ending tool call from peer ${peerId}:`,
					error,
				);
			} finally {
				this.endingRooms.delete(roomId);
			}
		});
	}

	async deleteSession(peerId: PeerId): Promise<void> {
		const session = this.sessions.get(peerId);
		const agentId = this.peerToAgentId.get(peerId);

		if (session) {
			try {
				await session.disconnect();
			} catch (error) {
				console.error(`Error closing session for peer ${peerId}:`, error);
			}
			this.sessions.delete(peerId);
		}

		if (agentId) {
			try {
				await elevenLabs.conversationalAi.agents.delete(agentId);
				console.log(`Deleted ElevenLabs agent ${agentId} for peer ${peerId}`);
			} catch (error) {
				console.error(
					`Error deleting ElevenLabs agent ${agentId} for peer ${peerId}:`,
					error,
				);
			}
			this.peerToAgentId.delete(peerId);
		}
	}

	getSession(peerId: PeerId): ElevenLabsConversation | undefined {
		return this.sessions.get(peerId);
	}

	async cleanup(): Promise<void> {
		const promises = Array.from(this.sessions.keys()).map((peerId) =>
			this.deleteSession(peerId).catch((error) => {
				console.error(`Failed to cleanup session for peer ${peerId}:`, error);
			}),
		);

		await Promise.allSettled(promises);
	}
}
