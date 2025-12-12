export abstract class DomainError extends Error {
	code: string;
	statusCode: number;

	constructor(code: string, message: string, statusCode: number = 500) {
		super(message);
		this.code = code;
		this.statusCode = statusCode;
	}
}
export class GameRoomFullError extends DomainError {
	constructor() {
		super(
			'GAME_ROOM_FULL',
			'Room is full. Please wait for a spot or create a new room.',
			400,
		);
		this.name = 'GameRoomFullError';
	}
}
