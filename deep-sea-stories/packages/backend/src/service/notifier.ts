import { EventEmitter } from 'node:events';
import type { AgentEvent } from '@deep-sea-stories/common';
import { FishjamWSNotifier, type RoomId } from '@fishjam-cloud/js-server-sdk';
import { roomService } from './room.js';

export class NotifierService extends EventEmitter {
	private fishjamNotifier: FishjamWSNotifier | null = null;
	private eventHistories: Map<
		string,
		Array<{ id: number; event: AgentEvent }>
	> = new Map();
	private nextEventIdPerRoom: Map<RoomId, number> = new Map();
	private readonly MAX_HISTORY = 100;

	constructor(fishjamId: string, managementToken: string) {
		super();

		this.fishjamNotifier = new FishjamWSNotifier(
			{
				fishjamId,
				managementToken,
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

	emitNotification(roomId: RoomId, event: AgentEvent) {
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
		if (!this.fishjamNotifier) return;

		this.fishjamNotifier.on('peerConnected', async (msg) => {
			console.log(
				`Peer connected: ${msg.peerId} (type: ${msg.peerType}) in room ${msg.roomId}`,
			);
			this.emit('peerConnected', { roomId: msg.roomId, peerId: msg.peerId });

			const gameRoom = roomService.getGameRoom(msg.roomId);
			if (!gameRoom) {
				console.warn(
					`No game session found for room ${msg.roomId} when peer ${msg.peerId} connected.`,
				);
				return;
			}

			const playerName = gameRoom.connectPlayer(msg.peerId);
			if (!playerName) return;

			console.log(
				`Attempting to start game for newly connected peer ${msg.peerId}...`,
			);

			const playerJoinedEvent = {
				type: 'playerJoined' as const,
				name: playerName,
				timestamp: Date.now(),
			};
			this.emitNotification(msg.roomId, playerJoinedEvent);
		});

		this.fishjamNotifier.on('peerDisconnected', async (msg) => {
			console.log(`Peer disconnected: ${msg.peerId} from room ${msg.roomId}`);

			const gameRoom = roomService.getGameRoom(msg.roomId);

			if (!gameRoom) {
				console.warn('No game room with id %s', msg.roomId);
				return;
			}

			const playerName = await gameRoom.removePlayer(msg.peerId);
			if (!playerName) return;

			const playerLeftEvent = {
				type: 'playerLeft' as const,
				name: playerName,
				timestamp: Date.now(),
			};
			this.emitNotification(msg.roomId, playerLeftEvent);
		});
	}
}
