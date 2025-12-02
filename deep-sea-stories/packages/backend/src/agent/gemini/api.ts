import {
	Behavior,
	GoogleGenAI,
	type LiveConnectParameters,
	Modality,
} from '@google/genai';
import { GEMINI_MODEL } from '../../config.js';
import {
	getFirstMessageForStory,
	getInstructionsForStory,
	getToolDescriptionForStory,
} from '../../utils.js';
import type { AgentConfig, VoiceAgentApi } from '../api.js';
import type { VoiceAgentSession } from '../session.js';
import { GeminiSession } from './session.js';

export class GeminiApi implements VoiceAgentApi {
	private genai: GoogleGenAI;

	constructor(apiKey: string) {
		this.genai = new GoogleGenAI({ apiKey });
	}

	async createAgentSession(config: AgentConfig): Promise<VoiceAgentSession> {
		const story = config.story;
		const instructions = getInstructionsForStory(story);

		console.log(
			`Creating Gemini agent for story "${story.title}" (ID: ${story.id})`,
		);

		const wrapper = new GeminiSession();
		let transcriptionParts: string[] = [];
		let isTalking = false;

		const params: LiveConnectParameters = {
			model: GEMINI_MODEL,
			config: {
				responseModalities: [Modality.AUDIO],
				systemInstruction: instructions,
				outputAudioTranscription: {},
				temperature: 0,
				tools: [
					{
						functionDeclarations: [
							{
								behavior: Behavior.NON_BLOCKING,
								description: getToolDescriptionForStory(story),
								name: 'endGame',
							},
						],
					},
				],
			},
			callbacks: {
				onmessage: (message) => {
					if (!isTalking) {
						isTalking = true;
						wrapper.startTurn();
					}

					const transcription =
						message.serverContent?.outputTranscription?.text;

					if (transcription) {
						transcriptionParts.push(transcription);
					}

					const turnFinished = message.serverContent?.turnComplete;

					if (turnFinished && transcriptionParts.length > 0) {
						config.onTranscription(transcriptionParts.join(''));
						transcriptionParts = [];
					}
					if (turnFinished) {
						wrapper.endTurn();
						isTalking = false;
					}

					const base64 = message.data;
					const onAudio = wrapper.getAgentAudioCallback();
					if (base64 && onAudio) {
						onAudio(Buffer.from(base64, 'base64'));
					}

					const interrupted = message.serverContent?.interrupted;
					if (interrupted) {
						wrapper.getInterruptionCallback()?.();
					}

					const toolCall = message.toolCall;
					if (toolCall) {
						toolCall.functionCalls?.forEach((call) => {
							switch (call.name) {
								case 'endGame':
									config.onEndGame();
									break;
								default:
									console.warn('Gemini called unknown tool %o', call.name);
							}
						});
					}
				},
				onerror: (e) => console.error('Gemini Error %o', e),
				onclose: (e) => console.error('Gemini Close: %o', e),
			},
		};

		const session = await this.genai.live.connect(params);
		wrapper.start(session, getFirstMessageForStory(story));

		return wrapper;
	}
}
