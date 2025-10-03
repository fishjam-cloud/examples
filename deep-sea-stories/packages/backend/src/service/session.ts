import { RealtimeSession } from '@openai/agents-realtime';
import type { RoomId, PeerId } from '@fishjam-cloud/js-server-sdk';
import { roomService } from './room.js';
import { RealtimeAgent } from '@openai/agents-realtime';
import { getInstructionsForStory } from '../utils.js';

export class SessionManager {
	private sessions = new Map<PeerId, RealtimeSession>();

	async createSession(
		peerId: PeerId,
		roomId: RoomId,
	): Promise<RealtimeSession> {
		await this.deleteSession(peerId);

		const story = roomService.getStory(roomId);
		if (!story) {
			throw new Error(`No story found for room ${roomId}`);
		}

		const agent = new RealtimeAgent({
			name: 'Riddle Master',
			instructions: getInstructionsForStory(story),
		});
		const session = new RealtimeSession(agent);

		this.sessions.set(peerId, session);

		session.sendMessage('start');

		return session;
	}

	async deleteSession(peerId: PeerId): Promise<void> {
		const session = this.sessions.get(peerId);
		if (session) {
			try {
				session.close();
			} catch (error) {
				console.error(`Error closing session for peer ${peerId}:`, error);
			}
			this.sessions.delete(peerId);
		}
	}

	getSession(peerId: PeerId): RealtimeSession | undefined {
		return this.sessions.get(peerId);
	}

	async cleanup(): Promise<void> {
		const promises = Array.from(this.sessions.keys()).map((peerId) =>
			this.deleteSession(peerId),
		);
		await Promise.all(promises);
	}
}
