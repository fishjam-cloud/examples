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

			roomService.addConnectedPeer(msg.roomId, msg.peerId);

			const story = roomService.getStory(msg.roomId);
			if (story) {
				const sessionManager = roomService.getSessionManager(msg.roomId);
				try {
					await sessionManager?.createSession(msg.peerId, msg.roomId);
					console.log(
						`Created AI session for peer ${msg.peerId} in room ${msg.roomId}`,
					);
				} catch (error) {
					console.error(
						`Failed to create session for peer ${msg.peerId}:`,
						error,
					);
				}
			}

			const fishjam_agent = roomService.getAgent(msg.roomId);
			fishjam_agent?.on('trackData', (trackMsg) => {
				const { data, peerId } = trackMsg;

				const sessionManager = roomService.getSessionManager(msg.roomId);
				const session = sessionManager?.getSession(peerId);

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
		});

		this.notifier.on('peerDisconnected', async (msg) => {
			console.log(`Peer disconnected: ${msg.peerId} from room ${msg.roomId}`);
			roomService.removeConnectedPeer(msg.roomId, msg.peerId);
			const sessionManager = roomService.getSessionManager(msg.roomId);
			await sessionManager?.deleteSession(msg.peerId);
		});
	}
}

export const notifierService = new NotifierService();
