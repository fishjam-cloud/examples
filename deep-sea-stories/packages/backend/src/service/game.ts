import type { PeerId, RoomId } from '@fishjam-cloud/js-server-sdk';
import { roomService } from './room.js';
import type { Story } from '../types.js';

class GameService {
	async startGame(roomId: RoomId, story: Story): Promise<void> {
		roomService.setStory(roomId, story);

		const connectedPeerIds = roomService.getConnectedPeers(roomId);

		if (connectedPeerIds.length > 0) {
			console.log(
				`Starting game for ${connectedPeerIds.length} connected peers in room ${roomId}`,
			);

			await this.startGameForPeers(roomId, connectedPeerIds);
		}
	}

	async startGameForPeers(roomId: RoomId, peerIds: PeerId[]): Promise<void> {
		const sessionManager = roomService.getSessionManager(roomId);

		if (!sessionManager) {
			throw new Error(`No session manager found for room ${roomId}`);
		}

		await Promise.all(
			peerIds.map(async (peerId) => {
				try {
					await this.startGameForPeer(roomId, peerId);
				} catch (error) {
					console.error(
						`Failed to start game for peer ${peerId} in room ${roomId}:`,
						error,
					);
				}
			}),
		);
	}

	async startGameForPeer(roomId: RoomId, peerId: PeerId): Promise<void> {
		const story = roomService.getStory(roomId);
		if (!story) {
			throw new Error(`No active game found for room ${roomId}`);
		}

		const sessionManager = roomService.getSessionManager(roomId);
		if (!sessionManager) {
			throw new Error(`No session manager found for room ${roomId}`);
		}

		try {
			await sessionManager.createSession(peerId, roomId);
			console.log(`Started game session for peer ${peerId} in room ${roomId}`);

			this.setupAudioStreaming(roomId, peerId);
		} catch (error) {
			console.error(`Failed to start game session for peer ${peerId}:`, error);
			throw error;
		}
	}

	private setupAudioStreaming(roomId: RoomId, peerId: PeerId): void {
		const fishjamAgent = roomService.getAgent(roomId);
		const sessionManager = roomService.getSessionManager(roomId);

		if (!fishjamAgent || !sessionManager) {
			console.error(
				`Cannot setup audio streaming: missing agent or session manager for room ${roomId}`,
			);
			return;
		}

		fishjamAgent.on('trackData', (trackMsg) => {
			const connectedPeers = roomService.getConnectedPeers(roomId);
			if (!connectedPeers.includes(peerId)) {
				return;
			}

			const { data } = trackMsg;
			const session = sessionManager.getSession(peerId);

			if (session && data) {
				console.log(
					`Sending ${data.byteLength} bytes of audio data to ElevenLabs for peer ${peerId}`,
				);
				try {
					const audioBuffer = Buffer.from(data);
					session.sendAudio(audioBuffer);
				} catch (error) {
					console.error(
						`Error sending audio to ElevenLabs for peer ${peerId}:`,
						error,
					);
				}
			}
		});
	}

	isGameActive(roomId: RoomId): boolean {
		return roomService.getStory(roomId) !== undefined;
	}

	async stopGame(roomId: RoomId): Promise<void> {
		const sessionManager = roomService.getSessionManager(roomId);
		if (sessionManager) {
			await sessionManager.cleanup();
		}

		roomService.setStory(roomId, null);

		console.log(`Stopped game for room ${roomId}`);
	}

	async removePeerFromGame(roomId: RoomId, peerId: PeerId): Promise<void> {
		const sessionManager = roomService.getSessionManager(roomId);
		if (sessionManager) {
			await sessionManager.deleteSession(peerId);
			console.log(`Removed peer ${peerId} from game in room ${roomId}`);
		}
	}
}

export const gameService = new GameService();
