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
				console.log(`Got error: ${msg}`);
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
			const sessionManager = roomService.getSessionManager(msg.roomId);
			await sessionManager?.createSession(msg.peerId, msg.roomId);
		});

		this.notifier.on('peerDisconnected', async (msg) => {
			const sessionManager = roomService.getSessionManager(msg.roomId);
			await sessionManager?.deleteSession(msg.peerId);
		});
	}
}

export const notifierService = new NotifierService();
