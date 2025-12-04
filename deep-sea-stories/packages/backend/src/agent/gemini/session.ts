import {
	type GoogleGenAI,
	type LiveConnectParameters,
	type LiveServerMessage,
	Modality,
	type Session,
} from '@google/genai';
import { GEMINI_MODEL } from '../../config.js';
import { getInstructionsForStory } from '../../utils.js';
import type { AgentConfig } from '../api.js';
import type { VoiceAgentSession } from '../session.js';

export class GeminiSession implements VoiceAgentSession {
	private onInterrupt: (() => void) | null = null;
	private onAgentAudio: ((audio: Buffer) => void) | null = null;
	private session: Session | null = null;
	private closing = false;
	private transcriptionParts: string[] = [];
	private genai: GoogleGenAI;
	private config: AgentConfig;

	private talkingTimeLeft = 0;
	private talkingInterval: NodeJS.Timeout | null = null;

	constructor(genai: GoogleGenAI, config: AgentConfig) {
		this.genai = genai;
		this.config = config;
	}

	sendAudio(audio: Buffer) {
		this.session?.sendRealtimeInput({
			audio: {
				data: audio.toString('base64'),
				mimeType: 'audio/pcm;rate=16000',
			},
		});
	}

	registerInterruptionCallback(onInterrupt: () => void) {
		this.onInterrupt = onInterrupt;
	}

	registerAgentAudioCallback(onAgentAudio: (audio: Buffer) => void) {
		this.onAgentAudio = onAgentAudio;
	}

	async waitUntilDone() {
		await new Promise((resolve) =>
			setTimeout(resolve, this.talkingTimeLeft + 2000),
		);
	}

	async open() {
		console.log(getInstructionsForStory(this.config.story));
		const params: LiveConnectParameters = {
			model: GEMINI_MODEL,
			config: {
				responseModalities: [Modality.AUDIO],
				systemInstruction: getInstructionsForStory(this.config.story),
				outputAudioTranscription: {},
				temperature: 0.01,
				tools: [
					{
						functionDeclarations: [
							{
								name: 'endGame',
								description: 'end the game',
							},
						],
					},
				],
				proactivity: {
					proactiveAudio: true,
				},
			},
			callbacks: {
				onmessage: (message) => this.onMessage(message),
				onerror: (e) => console.error('Gemini Error %o', e),
				onclose: (e) => {
					if (e.code !== 1000) {
						console.error('Gemini Close: %o', e.reason);
					}
				},
			},
		};

		this.session = await this.genai.live.connect(params);

		this.session.sendClientContent({
			turns: [
				{
					text: 'introduce yourself',
				},
			],
			turnComplete: true,
		});

		this.talkingInterval = setInterval(() => {
			this.talkingTimeLeft = Math.max(this.talkingTimeLeft - 100, 0);
		}, 100);
	}

	async close(wait: boolean) {
		this.closing = true;

		if (wait) {
			await this.waitUntilDone();
		}

		if (this.talkingInterval) clearInterval(this.talkingInterval);
		this.talkingInterval = null;

		this.session?.close();
		this.closing = false;
	}

	private onMessage(message: LiveServerMessage) {
		const transcription = message.serverContent?.outputTranscription?.text;

		if (transcription) {
			this.transcriptionParts.push(transcription);
		}

		const turnFinished = message.serverContent?.turnComplete;

		if (turnFinished && this.transcriptionParts.length > 0) {
			this.config.onTranscription(this.transcriptionParts.join(''));
			this.transcriptionParts = [];
		}

		const base64 = message.data;
		if (base64) {
			this.handleAgentAudio(Buffer.from(base64, 'base64'));
		}

		if (message.serverContent?.interrupted) {
			this.handleInterrupt();
		}

		message.toolCall?.functionCalls?.forEach((call) => {
			switch (call.name) {
				case 'endGame':
					console.log('Game ending tool called!');
					this.session?.sendToolResponse({
						functionResponses: [
							{
								id: call.id,
								name: call.name,
								response: { result: 'ok' },
							},
						],
					});
					this.config.onEndGame();
					break;
				default:
					console.warn('Gemini called unknown tool %o', call.name);
			}
		});
	}

	private handleInterrupt() {
		if (!this.onInterrupt) return;

		this.onInterrupt();
		this.talkingTimeLeft = 0;
	}

	private handleAgentAudio(audio: Buffer) {
		if (this.closing || !this.onAgentAudio) return;

		this.onAgentAudio(audio);
		this.talkingTimeLeft += this.outputAudioLengthMs(audio);
	}

	private outputAudioLengthMs(audio: Buffer) {
		const bytes = audio.byteLength;
		const bytesPerSample = 2; // 16 bits
		const samplesPerMs = 24; // 24k Hz sample rate

		return bytes / (bytesPerSample * samplesPerMs);
	}
}
