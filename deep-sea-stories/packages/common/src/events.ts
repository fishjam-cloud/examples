export interface BaseEvent {
	type: string;
	timestamp: number;
}

export interface JoinEvent extends BaseEvent {
	type: 'join';
	name: string;
}

export interface TranscriptionEvent extends BaseEvent {
	type: 'transcription';
	speaker: 'agent' | 'user';
	text: string;
}

export type AgentEvent = JoinEvent | TranscriptionEvent;
