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
			console.log(`Peer connected: ${msg.peerId} in room ${msg.roomId}`);

			if ( !roomService.getPeers(msg.roomId).find( p => p.id === msg.peerId ) ) {
				return;
			}

			const sessionManager = roomService.getSessionManager(msg.roomId);
			await sessionManager?.createSession(msg.peerId, msg.roomId);

			const fishjam_agent = roomService.getAgent(msg.roomId);
			fishjam_agent?.on('trackData', (msg) => {
				const {data, peerId} = msg;

				const session = sessionManager?.getSession(peerId);

				if (session && data) {
					console.log(`Sending ${data.byteLength} bytes of audio data to ElevenLabs for peer ${peerId}`);
					try {
						const audioBuffer = Buffer.from(data);
						session.sendAudio(audioBuffer);
					} catch (error) {
						console.error(`Error sending audio to ElevenLabs for peer ${peerId}:`, error);
					}
				}

			});
		});

		this.notifier.on('peerDisconnected', async (msg) => {
			console.log(`Peer disconnected: ${msg.peerId} from room ${msg.roomId}`);
			const sessionManager = roomService.getSessionManager(msg.roomId);
			await sessionManager?.deleteSession(msg.peerId);
		});
	}
}

export const notifierService = new NotifierService();
