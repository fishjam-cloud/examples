import type { PeerId, RoomId } from '@fishjam-cloud/js-server-sdk';
export interface Story {
	id: number;
	title: string;
	front: string;
	back: string;
}

export interface Conversation {
	sendAudio(audioBuffer: Buffer): void;
}

export interface VoiceAgentSessionManager {
	createSession(peerId: PeerId, roomId: RoomId): Promise<Conversation>;
	deleteSession(peerId: PeerId): Promise<void>;
	getSession(peerId: PeerId): Conversation | undefined;
}
