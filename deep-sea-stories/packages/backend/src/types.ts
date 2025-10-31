import type { EventEmitter } from 'node:events';

export interface Story {
	id: number;
	title: string;
	front: string;
	back: string;
}

export interface Conversation extends EventEmitter {
	sendAudio(audioBuffer: Buffer | Uint8Array): void;
	sendUserMessage(message: string): void;
	sendUserActivity(): void;
}
