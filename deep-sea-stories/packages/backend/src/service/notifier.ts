import { FishjamWSNotifier } from '@fishjam-cloud/js-server-sdk';
import { CONFIG } from '../config.js';
import { roomService } from './room.js';

class NotifierService {
	private notifier: FishjamWSNotifier | null = null;

	async initialize() {
		if (this.notifier !== null) {
			return;
		}
		this.notifier = new FishjamWSNotifier(
			{
				fishjamId: CONFIG.FISHJAM_ID,
				managementToken: CONFIG.FISHJAM_MANAGEMENT_TOKEN,
			},
			(msg) => {
				console.log(`FishjamWSNotifier got error: ${msg}`);
			},
			(code, reason) => {
				console.log(
					`FishjamWSNotifier closed with code: ${code}, reason: ${reason}`,
				);
			},
		);

		this.setupEventHandlers();
	}

	private setupEventHandlers() {
		if (!this.notifier) return;

		this.notifier.on('peerConnected', async (msg) => {
			console.log(`Peer connected: ${msg.peerId} in room ${msg.roomId}`);
			const gameSession = roomService.getGameSession(msg.roomId);
			if (!gameSession) {
				console.warn(
					`No game session found for room ${msg.roomId} when peer ${msg.peerId} connected.`,
				);
				return;
			}
			const { peerId } = gameSession.getFishjamAgent();
			if (msg.peerId === peerId) {
				return;
			}

			gameSession.setConnectedPeer(msg.peerId);
			if (!roomService.isGameActive(msg.roomId)) return;

			try {
				await gameSession.startGameForPeer(msg.peerId);
			} catch (error) {
				console.error(
					`Failed to start game for newly connected peer ${msg.peerId}:`,
					error,
				);
			}
		});

		this.notifier.on('peerDisconnected', async (msg) => {
			console.log(`Peer disconnected: ${msg.peerId} from room ${msg.roomId}`);

			const gameSession = roomService.getGameSession(msg.roomId);
			if (!gameSession) {
				console.warn(
					`No game session found for room ${msg.roomId} when peer ${msg.peerId} disconnected.`,
				);
				return;
			}
			gameSession.removeConnectedPeer(msg.peerId);

			if (roomService.isGameActive(msg.roomId)) {
				await gameSession.removePeerFromGame(msg.roomId, msg.peerId);
			}
		});
	}
}

export const notifierService = new NotifierService();
