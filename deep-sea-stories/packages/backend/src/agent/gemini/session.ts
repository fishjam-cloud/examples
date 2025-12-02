import type { Session } from '@google/genai';
import type { VoiceAgentSession } from '../session.js';

export class GeminiSession implements VoiceAgentSession {
	private onInterrupt: (() => void) | null = null;
	private onAgentAudio: ((audio: Buffer) => void) | null = null;
	private session: Session | null = null;

	start(session: Session, firstMessage: string) {
		this.session = session;
		this.session.sendClientContent({
			turns: [
				{
					text: `introduce yourself`,
				},
			],
		});
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

	async open() {}

	async close() {
		this.session?.close();
	}
}
