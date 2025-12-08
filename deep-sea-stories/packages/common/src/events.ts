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

export interface StorySelectedEvent extends BaseEvent {
	type: 'storySelected';
	storyId: number;
	storyTitle: string;
	userName: string;
}

export interface TranscriptionEvent extends BaseEvent {
	type: 'transcription';
	text: string;
}

export interface AiAgentMutedStatusChangedEvent extends BaseEvent {
	type: 'aiAgentMutedStatusChanged';
	muted: boolean;
}

export interface VADEvent extends BaseEvent {
	type: 'VAD';
	peerId: string | null;
}

export type AgentEvent =
	| PlayerJoinedEvent
	| PlayerLeftEvent
	| GameStartedEvent
	| GameEndedEvent
	| StorySelectedEvent
	| TranscriptionEvent
	| AiAgentMutedStatusChangedEvent
	| VADEvent;
