import type { PeerId, RoomId } from '@fishjam-cloud/js-server-sdk';
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

export interface VoiceAgentSessionManager {
	createSession(peerId: PeerId, roomId: RoomId): Promise<Conversation>;
	deleteSession(peerId: PeerId): Promise<void>;
	getSession(peerId: PeerId): Conversation | undefined;
	cleanup(): Promise<void>;
}
