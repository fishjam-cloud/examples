import type { RoomId } from '@fishjam-cloud/js-server-sdk';
import {
	GeminiConversation,
	createGameEndingToolDeclaration,
} from './gemini-conversation.js';
import { roomService } from './room.js';
import {
	getInstructionsForStory,
	getFirstMessageForStory,
	getToolDescriptionForStory,
} from '../utils.js';
import { GAME_TIME_LIMIT_SECONDS } from '@deep-sea-stories/common';
import type { Story } from '../types.js';
import {
	GameSessionNotFoundError,
	StoryNotFoundError,
} from '../domain/errors.js';
import { notifierService } from './notifier.js';

export class GeminiSessionManager {
	private session: GeminiConversation | null = null;
	private endingRoom: boolean = false;
	private gameEndingToolName: string | undefined;
	private roomId: RoomId;
	private sessionTimeout: NodeJS.Timeout | null = null;

	constructor(roomId: RoomId) {
		this.roomId = roomId;
	}

	async init() {
		const story = await this.resolveStory(this.roomId);

		const toolName = `game_ending_${story.id}`;
		this.gameEndingToolName = toolName;

		const toolDescription = getToolDescriptionForStory(story);
		const tool = createGameEndingToolDeclaration(toolName, toolDescription);

		const instructions = this.buildSystemInstruction(story);
		const firstMessage = getFirstMessageForStory(story);

		console.log(
			`[GeminiSession] Creating Gemini session for story "${story.title}" (ID: ${story.id})`,
		);

		this.session = new GeminiConversation({
			systemInstruction: instructions,
			tools: [tool],
		});

		await this.session.connect();

		// Send first message to start the conversation
		this.session.sendUserMessage(
			`Start the game now. Say the following welcome message: "${firstMessage}"`,
		);

		this.registerClientToolHandler(this.session, this.roomId);

		this.session.on('agentResponse', (event: { agent_response?: string }) => {
			if (event.agent_response) {
				console.log('[GeminiSession] Agent response:', event.agent_response);
				const transcriptionEvent = {
					type: 'transcription' as const,
					text: event.agent_response,
					timestamp: Date.now(),
				};
				notifierService.emitNotification(this.roomId, transcriptionEvent);
			}
		});

		this.session.on(
			'disconnected',
			async (event: { code: number; reason: string }) => {
				console.log(
					`[GeminiSession] Gemini session disconnected for room ${this.roomId}: ${event.code} - ${event.reason}`,
				);
				await this.handleSessionEnd('WebSocket disconnected');
			},
		);

		// Set session timeout (Gemini has a 10-minute default limit)
		this.sessionTimeout = setTimeout(
			() => {
				console.log(
					`[GeminiSession] Session timeout reached for room ${this.roomId}`,
				);
				this.handleSessionEnd('Session timeout');
			},
			GAME_TIME_LIMIT_SECONDS * 1000,
		);
	}

	private buildSystemInstruction(story: Story): string {
		const baseInstructions = getInstructionsForStory(story);
		return baseInstructions;
	}

	private registerClientToolHandler(
		session: GeminiConversation,
		roomId: RoomId,
	): void {
		session.on('clientToolCall', async (clientToolCall: unknown) => {
			const call =
				clientToolCall && typeof clientToolCall === 'object'
					? (clientToolCall as Record<string, unknown>)
					: undefined;
			const toolName =
				typeof call?.tool_name === 'string' ? call.tool_name : undefined;
			const toolCallId =
				typeof call?.tool_call_id === 'string' ? call.tool_call_id : undefined;

			if (!toolName || toolName !== this.gameEndingToolName) {
				return;
			}
			if (this.endingRoom) {
				return;
			}

			this.endingRoom = true;

			// Send tool response to acknowledge
			if (toolCallId) {
				session.sendToolResponse(toolCallId, 'Game ended successfully');
			}

			const gameSession = roomService.getGameSession(roomId);

			if (!gameSession) {
				console.warn(
					`[GeminiSession] Received game-ending tool call for room ${roomId} without active game session`,
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
					`[GeminiSession] Game session for room ${roomId} ended after game-ending tool call`,
				);
			} catch (error) {
				console.error(
					`[GeminiSession] Failed to stop game for room ${roomId} after game-ending tool call`,
					error,
				);
			} finally {
				this.endingRoom = false;
			}
		});
	}

	getSession(): GeminiConversation | null {
		return this.session;
	}

	async deleteSession(): Promise<void> {
		if (this.sessionTimeout) {
			clearTimeout(this.sessionTimeout);
			this.sessionTimeout = null;
		}

		if (this.session) {
			try {
				await this.session.disconnect();
				console.log(`[GeminiSession] Disconnected Gemini session`);
			} catch (error) {
				console.error(`[GeminiSession] Error closing session`, error);
			}
			this.session = null;
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

	private async handleSessionEnd(reason: string): Promise<void> {
		if (this.endingRoom) {
			return;
		}

		this.endingRoom = true;

		const gameSession = roomService.getGameSession(this.roomId);

		if (!gameSession) {
			console.warn(
				`[GeminiSession] Session ended for room ${this.roomId} but no active game session found`,
			);
			this.endingRoom = false;
			return;
		}

		if (!roomService.isGameActive(this.roomId)) {
			this.endingRoom = false;
			return;
		}

		try {
			console.log(
				`[GeminiSession] Stopping game for room ${this.roomId} due to: ${reason}`,
			);
			await gameSession.stopGame();
		} catch (error) {
			console.error(
				`[GeminiSession] Failed to stop game for room ${this.roomId} after session end`,
				error,
			);
		} finally {
			this.endingRoom = false;
		}
	}
}
