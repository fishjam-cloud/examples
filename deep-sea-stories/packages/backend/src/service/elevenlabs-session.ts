import type { RoomId, PeerId } from '@fishjam-cloud/js-server-sdk';
import {
	elevenLabs,
	ElevenLabsConversation,
} from './elevenlabs-conversation.js';
import { roomService } from './room.js';
import { getInstructionsForStory } from '../utils.js';
import { CONFIG } from '../config.js';
import type { VoiceAgentSessionManager } from '../types.js';
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

		const story = await this.resolveStory(roomId);
		const instructions = getInstructionsForStory(story);

		const { agentId } = await elevenLabs.conversationalAi.agents.create({
			conversationConfig: {
				agent: {
					firstMessage: 'Welcome to Deepsea stories',
					language: 'en',
					prompt: {
						prompt: instructions,
					},
				},
			},
		});

		const session = new ElevenLabsConversation(
			agentId,
			CONFIG.ELEVENLABS_API_KEY,
		);
		await session.connect();

		this.sessions.set(peerId, session);
		return session;
	}

	async deleteSession(peerId: PeerId): Promise<void> {
		const session = this.sessions.get(peerId);
		if (session) {
			try {
				await session.disconnect();
			} catch (error) {
				console.error(`Error closing session for peer ${peerId}:`, error);
			}
			this.sessions.delete(peerId);
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
