import { AudioInterface } from '@elevenlabs/elevenlabs-js/api/resources/conversationalAi/conversation/index.js';

export class ForwardingAudioInterface extends AudioInterface {
	private inputCallback: ((audio: Buffer) => void) | null = null;
	private onAgentAudio: ((audio: Buffer) => void) | null = null;
	private onInterrupt: (() => void) | null = null;

	setInterruptCallback(onInterrupt: () => void) {
		this.onInterrupt = onInterrupt;
	}

	setAgentAudioCallback(onAgentAudio: (audio: Buffer) => void) {
		this.onAgentAudio = onAgentAudio;
	}

	sendAudio(audio: Buffer): void {
		if (!this.inputCallback) return;

		this.inputCallback(audio);
	}

	start(inputCallback: (audio: Buffer) => void): void {
		this.inputCallback = inputCallback;
	}

	stop(): void {
		this.inputCallback = null;
	}

	output(buffer: Buffer): void {
		if (buffer.length <= 0) {
			console.warn('[Audio Interface] Received empty audio buffer from agent');
			return;
		}

		if (!this.onAgentAudio) console.error('Agent callback missing!');

		this.onAgentAudio?.(buffer);
	}

	interrupt(): void {
		console.warn('Agent interrupted!');
		this.onInterrupt?.();
	}
}
