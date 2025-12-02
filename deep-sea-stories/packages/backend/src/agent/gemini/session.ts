import type { Session } from '@google/genai';
import type { VoiceAgentSession } from '../session.js';

export class GeminiSession implements VoiceAgentSession {
	private onInterrupt: (() => void) | null = null;
	private onAgentAudio: ((audio: Buffer) => void) | null = null;
	private session: Session | null = null;
	private closing = false;
	private talking = false;

	start(session: Session, firstMessage: string) {
		this.session = session;
		const prompt = `Please say exactly this to the user: "${firstMessage}"`;
		this.session.sendClientContent({
			turns: [
				{
					role: 'user',
					parts: [{ text: prompt }],
				},
			],
			turnComplete: true,
		});
	}

	endTurn() {
		this.talking = false;
	}

	startTurn() {
		if (this.closing) return;

		this.talking = true;
	}

	sendAudio(audio: Buffer) {
		this.session?.sendRealtimeInput({
			audio: {
				data: audio.toString('base64'),
				mimeType: 'audio/pcm;rate=16000',
			},
		});
	}

	getInterruptionCallback() {
		return this.onInterrupt;
	}

	getAgentAudioCallback() {
		return this.onAgentAudio;
	}

	registerInterruptionCallback(onInterrupt: () => void) {
		this.onInterrupt = onInterrupt;
	}

	registerAgentAudioCallback(onAgentAudio: (audio: Buffer) => void) {
		this.onAgentAudio = onAgentAudio;
	}

	async waitUntilDone(timeoutMs: number = 30_000) {
		for (let i = 0; this.talking && i < timeoutMs; i += 100) {
			await new Promise((resolve) => setTimeout(resolve, 100));
		}
	}

	async open() {}

	async close() {
		this.closing = true;
		await this.waitUntilDone();
		this.session?.close();
	}
}
