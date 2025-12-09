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
	private transcriptionParts: string[] = [];
	private genai: GoogleGenAI;
	private config: AgentConfig;
	private previousHandle: string | undefined = undefined;
	private closing = false;
	private opening = false;
	private reconnecting = false;

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

	async announceTimeExpired() {
		if (!this.session) return;
		
		console.log('Sending time expired message to agent...');
		this.session.sendClientContent({
			turns: [{
				text: 'The game time has expired. Please tell the players that time is up, evaluate how close they were to solving the riddle, and then end the game by calling the endGame tool.'
			}],
			turnComplete: true,
		});
	}

	async waitUntilDone() {
		await new Promise((resolve) =>
			setTimeout(resolve, this.talkingTimeLeft + 2000),
		);
	}

	async open() {
		if (this.opening) return;
		this.opening = true;

		const params: LiveConnectParameters = {
			model: GEMINI_MODEL,
			config: {
				responseModalities: [Modality.AUDIO],
				systemInstruction: getInstructionsForStory(this.config.story),
				outputAudioTranscription: {},
				temperature: 0.1,
				thinkingConfig: {
					thinkingBudget: -1,
				},
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
				sessionResumption: { handle: this.previousHandle },
			},
			callbacks: {
				onmessage: (message) => this.onMessage(message),
				onerror: (e) => console.error('Gemini Error %o', e),
				onclose: (e) => {
					if (e.code !== 1000) {
						console.error('Gemini Close: code=%d reason=%s', e.code, e.reason);
						if (!this.closing && this.previousHandle) {
							console.log('Attempting auto-reconnect with resumption...');
							this.reconnect();
						}
					}
				},
			},
		};

		this.session = await this.genai.live.connect(params);

		if (!this.previousHandle) {
			this.session.sendClientContent({
				turns: [
					{
						text: 'introduce yourself',
					},
				],
				turnComplete: true,
			});
		}

		if (this.talkingInterval) clearInterval(this.talkingInterval);
		this.talkingInterval = setInterval(() => {
			this.talkingTimeLeft = Math.max(this.talkingTimeLeft - 100, 0);
		}, 100);

		this.opening = false;
	}

	async close(wait: boolean) {
		this.closing = true;

		if (wait) {
			await this.waitUntilDone();
		}

		if (this.talkingInterval) {
			clearInterval(this.talkingInterval);
			this.talkingInterval = null;
		}

		this.session?.close();
		this.session = null;
		this.closing = false;
	}

	private async reconnect() {
		if (this.reconnecting || this.closing) return;

		this.reconnecting = true;
		try {
			if (this.session) {
				this.session.close();
				this.session = null;
			}

			await new Promise((resolve) => setTimeout(resolve, 500));

			await this.open();

			this.sendContinuationPrompt();

			console.log('Session reconnected successfully');
		} catch (err) {
			console.error('Failed to reconnect:', err);
		} finally {
			this.reconnecting = false;
		}
	}

	private sendContinuationPrompt() {
		if (!this.session) return;
		this.session.sendClientContent({
			turns: [{ text: 'continue' }],
			turnComplete: true,
		});
	}

	private async onMessage(message: LiveServerMessage) {
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

		if (message.sessionResumptionUpdate?.newHandle) {
			this.previousHandle = message.sessionResumptionUpdate.newHandle;
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
