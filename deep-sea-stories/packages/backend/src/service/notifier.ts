import { FishjamWSNotifier } from '@fishjam-cloud/js-server-sdk';
import { CONFIG } from '../config.js';
import { roomService } from './room.js';
import { EventEmitter } from 'node:events';
import type { AgentEvent } from '@deep-sea-stories/common';

class NotifierService extends EventEmitter {
	private notifier: FishjamWSNotifier | null = null;
	private eventHistories: Map<
		string,
		Array<{ id: number; event: AgentEvent }>
	> = new Map();
	private nextEventIdPerRoom: Map<string, number> = new Map();
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

	emitNotification(roomId: string, event: AgentEvent) {
		const eventId = this.nextEventIdPerRoom.get(roomId) || 1;
		this.nextEventIdPerRoom.set(roomId, eventId + 1);

		const history = this.eventHistories.get(roomId) || [];
		history.push({ id: eventId, event });
		if (history.length > this.MAX_HISTORY) {
			history.shift();
		}
		this.eventHistories.set(roomId, history);

		console.log(`[NotifierService] Emitting notification #${eventId}:`, event);
		this.emit('notification', roomId, event, eventId);
	}

	getEventHistory(
		roomId: string,
		since?: number,
	): Array<{ id: number; event: AgentEvent }> {
		const history = this.eventHistories.get(roomId) || [];
		if (since === undefined) {
			return [...history];
		}
		return history.filter((item) => item.id > since);
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
				this.emitNotification(msg.roomId, playerJoinedEvent);
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
				this.emitNotification(msg.roomId, playerLeftEvent);
			}

			gameSession.removeConnectedPeer(msg.peerId);
			if (roomService.isGameActive(msg.roomId)) {
				await gameSession.removePeerFromGame(msg.peerId);
			}
		});
	}
}

export const notifierService = new NotifierService();
