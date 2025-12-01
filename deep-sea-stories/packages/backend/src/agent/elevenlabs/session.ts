import type { Conversation } from '@elevenlabs/elevenlabs-js/api/resources/conversationalAi/conversation/index.js';
import type { VoiceAgentSession } from '../session.js';
import type { ForwardingAudioInterface } from './audioInterface.js';

export class ElevenLabsSession implements VoiceAgentSession {
	private session: Conversation;
	private audioInterface: ForwardingAudioInterface;

	constructor(audioInterface: ForwardingAudioInterface, session: Conversation) {
		this.audioInterface = audioInterface;
		this.session = session;
	}

	sendAudio(audio: Buffer) {
		this.audioInterface.sendAudio(audio);
	}

	registerInterruptionCallback(onInterrupt: () => void) {
		this.audioInterface.setInterruptCallback(onInterrupt);
	}

	registerAgentAudioCallback(onAgentAudio: (audio: Buffer) => void) {
		this.audioInterface.setAgentAudioCallback(onAgentAudio);
	}

	async open() {
		await this.session.startSession();
	}

	async close() {
		this.session.endSession();
	}
}
