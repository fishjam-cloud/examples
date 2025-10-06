import type { RoomId, PeerId } from '@fishjam-cloud/js-server-sdk';
import { elevenLabs, ElevenLabsConversation } from './elevenlabs.js';
import { roomService } from './room.js';
import { getInstructionsForStory } from '../utils.js';
import { CONFIG } from '../config.js';

export class SessionManager {
	private sessions = new Map<PeerId, ElevenLabsConversation>();

	async createSession(
		peerId: PeerId,
		roomId: RoomId,
	): Promise<ElevenLabsConversation> {
		await this.deleteSession(peerId);

		const story = roomService.getStory(roomId);
		if (!story) {
			throw new Error(`No story found for room ${roomId}`);
		}

		const instructions = getInstructionsForStory(story);

		const agentId = await elevenLabs.createAgent({
			agent_prompt: instructions,
			first_message: 'Welcome to the deep sea stories!',
			language: 'en',
		});

		const session = new ElevenLabsConversation(
			agentId.agent_id,
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
			this.deleteSession(peerId),
		);
		await Promise.all(promises);
	}
}
