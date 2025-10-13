import type { PeerId, RoomId, TrackId } from '@fishjam-cloud/js-server-sdk';
import { roomService } from './room.js';
import type { Story } from '../types.js';

class GameService {
	async startGame(roomId: RoomId, story: Story): Promise<void> {
		roomService.setStory(roomId, story);

		const connectedPeerIds = roomService.getConnectedPeers(roomId);

		if (!connectedPeerIds.length) {
			throw new Error(`No connected peers in room ${roomId}`);
		}
		console.log(
			`Starting game for ${connectedPeerIds.length} connected peers in room ${roomId}`,
		);

		await this.startGameForPeers(roomId, connectedPeerIds);
	}

	async startGameForPeers(roomId: RoomId, peerIds: PeerId[]): Promise<void> {
		const sessionManager = roomService.getElevenLabsSessionManager(roomId);

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
		this.setupAudioStreaming(roomId);
	}

	async startGameForPeer(roomId: RoomId, peerId: PeerId): Promise<void> {
		const story = roomService.getStory(roomId);
		if (!story) {
			throw new Error(`No active game found for room ${roomId}`);
		}

		const sessionManager = roomService.getElevenLabsSessionManager(roomId);
		if (!sessionManager) {
			throw new Error(`No session manager found for room ${roomId}`);
		}

		try {
			await sessionManager.createSession(peerId, roomId);
			console.log(`Started game session for peer ${peerId} in room ${roomId}`);
		} catch (error) {
			console.error(`Failed to start game session for peer ${peerId}:`, error);
			throw error;
		}
	}

	private setupAudioStreaming(roomId: RoomId): void {
		const { fishjamAgent } = roomService.getAgent(roomId);
		const sessionManager = roomService.getElevenLabsSessionManager(roomId);
		const connectedPeers = roomService.getConnectedPeers(roomId);

		if (!fishjamAgent || !sessionManager) {
			console.error(
				`Cannot setup audio streaming: missing agent or session manager for room ${roomId}`,
			);
			return;
		}

		fishjamAgent.on('trackData', (trackMsg) => {
			if (!connectedPeers.includes(trackMsg.peerId)) {
				return;
			}

			const { data } = trackMsg;
			const session = sessionManager.getSession(trackMsg.peerId);

			if (session && data) {
				try {
					const audioBuffer = Buffer.from(data);
					session.sendAudio(audioBuffer);
				} catch (error) {
					console.error(
						`Error sending audio to ElevenLabs for peer ${trackMsg.peerId}:`,
						error,
					);
				}
			}
		});
		const audioTrack = fishjamAgent.createTrack({
			encoding: 'pcm16',
			sampleRate: 16000,
			channels: 1,
		});

		for (const peerId of connectedPeers) {
			try {
				const agentSession = sessionManager.getSession(peerId);
				agentSession?.on('agentAudio', (audioEvent) => {
					try {
						const audioBuffer = Uint8Array.from(
							atob(audioEvent.audio_base_64),
							(c) => c.charCodeAt(0),
						);
						if (!audioBuffer) {
							console.error('Received empty audio buffer from ElevenLabs');
							return;
						}
						fishjamAgent.sendData(audioTrack.id as TrackId, audioBuffer);
					} catch (error) {
						console.error('Error sending agent audio track to room:', error);
					}
				});
			} catch (error) {
				console.error(
					`Error setting up agent audio for peer ${peerId}:`,
					error,
				);
			}
		}
	}

	isGameActive(roomId: RoomId): boolean {
		return roomService.getStory(roomId) !== undefined;
	}

	async stopGame(roomId: RoomId): Promise<void> {
		const sessionManager = roomService.getElevenLabsSessionManager(roomId);
		if (sessionManager) {
			await sessionManager.cleanup();
		}

		roomService.setStory(roomId, null);

		console.log(`Stopped game for room ${roomId}`);
	}

	async removePeerFromGame(roomId: RoomId, peerId: PeerId): Promise<void> {
		const sessionManager = roomService.getElevenLabsSessionManager(roomId);
		if (sessionManager) {
			await sessionManager.deleteSession(peerId);
			console.log(`Removed peer ${peerId} from game in room ${roomId}`);
		}
	}
}

export const gameService = new GameService();
