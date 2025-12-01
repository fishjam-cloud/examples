import type { RoomId } from '@fishjam-cloud/js-server-sdk';
import type { GameRoom } from '../game/room.js';

class RoomService {
	private rooms = new Map<RoomId, GameRoom>();

	getGameRoom(roomId: RoomId): GameRoom | undefined {
		return this.rooms.get(roomId);
	}

	setGameRoom(roomId: RoomId, gameRoom: GameRoom) {
		this.rooms.set(roomId, gameRoom);
	}

	isGameActive(roomId: RoomId): boolean {
		return this.rooms.get(roomId)?.getGameSession() !== undefined;
	}
}

export const roomService = new RoomService();
