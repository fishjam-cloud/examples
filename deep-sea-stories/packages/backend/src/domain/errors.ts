export abstract class DomainError extends Error {
	code: string;
	statusCode: number;

	constructor(code: string, message: string, statusCode: number = 500) {
		super(message);
		this.code = code;
		this.statusCode = statusCode;
	}
}

export class GameSessionNotFoundError extends DomainError {
	constructor(roomId: string) {
		super(
			'GAME_SESSION_NOT_FOUND',
			`No game session found for room ${roomId}`,
			404,
		);
		this.name = 'GameSessionNotFoundError';
	}
}

export class StoryNotFoundError extends DomainError {
	constructor(roomId: string) {
		super('STORY_NOT_FOUND', `No story available for room ${roomId}`, 400);
		this.name = 'StoryNotFoundError';
	}
}

export class NoPeersConnectedError extends DomainError {
	constructor(roomId: string) {
		super('NO_PEERS_CONNECTED', `No connected peers in room ${roomId}`, 400);
		this.name = 'NoPeersConnectedError';
	}
}

export class NoVoiceSessionManagerError extends DomainError {
	constructor(roomId: string) {
		super(
			'NO_VOICE_SESSION_MANAGER',
			`No voice session manager configured for room ${roomId}`,
			500,
		);
		this.name = 'NoVoiceSessionManagerError';
	}
}

export class AudioConnectionError extends DomainError {
	constructor(peerId: string, reason: string) {
		super(
			'AUDIO_CONNECTION_ERROR',
			`Failed to establish audio connection for peer ${peerId}: ${reason}`,
			500,
		);
		this.name = 'AudioConnectionError';
	}
}

export class FailedToStartStoryError extends DomainError {
	constructor(storyId: number, reason: string) {
		super(
			'FAILED_TO_START_STORY',
			`Failed to start story ${storyId}: ${reason}`,
			500,
		);
		this.name = 'FailedToStartStoryError';
	}
}
