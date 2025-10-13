import { FishjamWSNotifier } from '@fishjam-cloud/js-server-sdk';
import { CONFIG } from '../config.js';
import { roomService } from './room.js';
import { gameService } from './game.js';

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
			const { peerId } = roomService.getAgent(msg.roomId);
			if (msg.peerId === peerId) {
				return;
			}

			roomService.addConnectedPeer(msg.roomId, msg.peerId);
			if (!gameService.isGameActive(msg.roomId)) return;

			try {
				await gameService.startGameForPeer(msg.roomId, msg.peerId);
			} catch (error) {
				console.error(
					`Failed to start game for newly connected peer ${msg.peerId}:`,
					error,
				);
			}
		});

		this.notifier.on('peerDisconnected', async (msg) => {
			console.log(`Peer disconnected: ${msg.peerId} from room ${msg.roomId}`);

			roomService.removeConnectedPeer(msg.roomId, msg.peerId);

			if (gameService.isGameActive(msg.roomId)) {
				await gameService.removePeerFromGame(msg.roomId, msg.peerId);
			}
		});
	}
}

export const notifierService = new NotifierService();
