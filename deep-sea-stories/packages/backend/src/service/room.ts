import type { RoomId } from '@fishjam-cloud/js-server-sdk';
import type { GameSession } from './game-session.js';

class RoomService {
	private RoomToGameSession = new Map<RoomId, GameSession>();

	getGameSession(roomId: RoomId): GameSession | undefined {
		return this.RoomToGameSession.get(roomId);
	}

	setGameSession(roomId: RoomId, gameSession: GameSession) {
		this.RoomToGameSession.set(roomId, gameSession);
	}

	isGameActive(roomId: RoomId): boolean {
		const gameSession = this.RoomToGameSession.get(roomId);
		return gameSession !== undefined && gameSession.getStory() !== undefined;
	}
}

export const roomService = new RoomService();
