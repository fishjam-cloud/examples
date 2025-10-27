import { FishjamWSNotifier } from '@fishjam-cloud/js-server-sdk';
import { CONFIG } from '../config.js';
import { roomService } from './room.js';
import { EventEmitter } from 'node:events';

class NotifierService extends EventEmitter {
	private notifier: FishjamWSNotifier | null = null;
	private eventHistory: Array<{ id: number; event: any }> = [];
	private nextEventId = 1;
	private readonly MAX_HISTORY = 100;

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

	emitNotification(event: any) {
		const eventId = this.nextEventId++;
		this.eventHistory.push({ id: eventId, event });

		if (this.eventHistory.length > this.MAX_HISTORY) {
			this.eventHistory.shift();
		}

		console.log(`[NotifierService] Emitting notification #${eventId}:`, event);
		this.emit('notification', event, eventId);
	}

	getEventHistory(since?: number): Array<{ id: number; event: any }> {
		if (since === undefined) {
			return [...this.eventHistory];
		}
		return this.eventHistory.filter((item) => item.id > since);
	}

	private setupEventHandlers() {
		if (!this.notifier) return;

		this.notifier.on('peerConnected', async (msg) => {
			console.log(`Peer connected: ${msg.peerId} in room ${msg.roomId}`);
			this.emit('peerConnected', { roomId: msg.roomId, peerId: msg.peerId });

			console.log(
				`Attempting to start game for newly connected peer ${msg.peerId}...`,
			);
			const gameSession = roomService.getGameSession(msg.roomId);
			if (!gameSession) {
				console.warn(
					`No game session found for room ${msg.roomId} when peer ${msg.peerId} connected.`,
				);
				return;
			}
			const { peerId } = gameSession.getFishjamAgent();

			if (msg.peerId !== peerId) {
				const peerName = gameSession.getPeerName(msg.peerId) || msg.peerId;
				const playerJoinedEvent = {
					type: 'playerJoined' as const,
					name: peerName,
					timestamp: Date.now(),
				};
				this.emitNotification(playerJoinedEvent);
			}

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
			this.emit('peerDisconnected', { roomId: msg.roomId, peerId: msg.peerId });

			const gameSession = roomService.getGameSession(msg.roomId);
			if (!gameSession) {
				console.warn(
					`No game session found for room ${msg.roomId} when peer ${msg.peerId} disconnected.`,
				);
				return;
			}

			const { peerId } = gameSession.getFishjamAgent();

			if (msg.peerId !== peerId) {
				const peerName = gameSession.getPeerName(msg.peerId) || msg.peerId;
				const playerLeftEvent = {
					type: 'playerLeft' as const,
					name: peerName,
					timestamp: Date.now(),
				};
				this.emitNotification(playerLeftEvent);
			}

			gameSession.removeConnectedPeer(msg.peerId);
			if (roomService.isGameActive(msg.roomId)) {
				await gameSession.removePeerFromGame(msg.roomId, msg.peerId);
			}
		});
	}
}

export const notifierService = new NotifierService();
