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
		this.audioInterface.sendAudio(this.boostAudioVolume(audio, 7.0));
	}

	registerInterruptionCallback(onInterrupt: () => void) {
		this.audioInterface.setInterruptCallback(onInterrupt);
	}

	registerAgentAudioCallback(onAgentAudio: (audio: Buffer) => void) {
		this.audioInterface.setAgentAudioCallback(onAgentAudio);
	}

	async announceTimeExpired() {
		console.log('ElevenLabs session time expired (handled by platform)');
	}

	async open() {
		await this.session.startSession();
	}

	async close(_wait: boolean) {
		this.session.endSession();
	}

	private boostAudioVolume(audioBuffer: Buffer, gain = 2.0): Buffer {
		for (let offset = 0; offset < audioBuffer.length - 1; offset += 2) {
			const sample = audioBuffer.readInt16LE(offset);
			const amplified = Math.round(sample * gain);
			const clamped = Math.max(-32768, Math.min(32767, amplified));
			audioBuffer.writeInt16LE(clamped, offset);
		}

		return audioBuffer;
	}
}
