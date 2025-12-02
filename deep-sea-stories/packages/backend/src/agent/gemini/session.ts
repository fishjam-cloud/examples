import {
	Behavior,
	type GoogleGenAI,
	type LiveConnectParameters,
	type LiveServerMessage,
	Modality,
	type Session,
} from '@google/genai';
import { GEMINI_MODEL } from '../../config.js';
import {
	getFirstMessageForStory,
	getInstructionsForStory,
	getToolDescriptionForStory,
} from '../../utils.js';
import type { AgentConfig } from '../api.js';
import type { VoiceAgentSession } from '../session.js';

export class GeminiSession implements VoiceAgentSession {
	private onInterrupt: (() => void) | null = null;
	private onAgentAudio: ((audio: Buffer) => void) | null = null;
	private session: Session | null = null;
	private closing = false;
	private talking = false;
	private transcriptionParts: string[] = [];
	private genai: GoogleGenAI;
	private config: AgentConfig;

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

	async waitUntilDone(timeoutMs: number = 120_000) {
		for (let i = 0; this.talking && i < timeoutMs; i += 100) {
			await new Promise((resolve) => setTimeout(resolve, 100));
		}
	}

	async open() {
		const params: LiveConnectParameters = {
			model: GEMINI_MODEL,
			config: {
				responseModalities: [Modality.AUDIO],
				systemInstruction: getInstructionsForStory(this.config.story),
				outputAudioTranscription: {},
				temperature: 0,
				tools: [
					{
						functionDeclarations: [
							{
								behavior: Behavior.NON_BLOCKING,
								description: getToolDescriptionForStory(this.config.story),
								name: 'endGame',
							},
						],
					},
				],
			},
			callbacks: {
				onmessage: (message) => this.onMessage(message),
				onerror: (e) => console.error('Gemini Error %o', e),
				onclose: (e) => {
					this.talking = false;
					if (e.code !== 1000) {
						console.error('Gemini Close: %o', e);
					}
				},
			},
		};

		this.session = await this.genai.live.connect(params);

		const firstMessage = getFirstMessageForStory(this.config.story);
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

	async close(wait: boolean) {
		this.closing = true;
		if (wait) {
			await this.waitUntilDone();
		}
		this.session?.close();
		this.closing = false;
	}

	private onMessage(message: LiveServerMessage) {
		if (!this.talking) {
			this.startTurn();
		}

		const transcription = message.serverContent?.outputTranscription?.text;

		if (transcription) {
			this.transcriptionParts.push(transcription);
		}

		const turnFinished = message.serverContent?.turnComplete;

		if (turnFinished && this.transcriptionParts.length > 0) {
			this.config.onTranscription(this.transcriptionParts.join(''));
			this.transcriptionParts = [];
		}
		if (turnFinished) {
			this.endTurn();
		}

		const base64 = message.data;
		if (base64 && this.onAgentAudio) {
			this.onAgentAudio(Buffer.from(base64, 'base64'));
		}

		if (message.serverContent?.interrupted) {
			this.onInterrupt?.();
		}

		message.toolCall?.functionCalls?.forEach((call) => {
			switch (call.name) {
				case 'endGame':
					this.config.onEndGame();
					break;
				default:
					console.warn('Gemini called unknown tool %o', call.name);
			}
		});
	}

	private endTurn() {
		this.talking = false;
	}

	private startTurn() {
		if (this.closing) return;

		this.talking = true;
	}
}
