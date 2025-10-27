export interface BaseEvent {
	type: string;
	timestamp: number;
}

export interface PlayerJoinedEvent extends BaseEvent {
	type: 'playerJoined';
	name: string;
}

export interface PlayerLeftEvent extends BaseEvent {
	type: 'playerLeft';
	name: string;
}

export interface GameStartedEvent extends BaseEvent {
	type: 'gameStarted';
}

export interface GameEndedEvent extends BaseEvent {
	type: 'gameEnded';
}

export interface TranscriptionEvent extends BaseEvent {
	type: 'transcription';
	text: string;
}

export type AgentEvent =
	| PlayerJoinedEvent
	| PlayerLeftEvent
	| GameStartedEvent
	| GameEndedEvent
	| TranscriptionEvent;
