import { CONFIG } from '../config.js';
import { EventEmitter } from 'node:events';
import {
	GoogleGenAI,
	Modality,
	type Session,
	type LiveServerMessage,
	type FunctionDeclaration,
	type Tool,
} from '@google/genai';
import type { Conversation } from '../types.js';

const GEMINI_LIVE_MODEL = 'gemini-2.0-flash-live-001';

export interface GeminiSessionConfig {
	systemInstruction: string;
	tools?: Tool[];
}

/**
 * WebSocket-based conversation with Google Gemini Live API for real-time audio streaming
 * https://ai.google.dev/gemini-api/docs/live
 *
 * Events emitted:
 * - 'ready': () - When session is ready
 * - 'agentResponse': ({ agent_response: string }) - Text response from agent
 * - 'agentAudio': ({ audio_base_64: string }) - Audio response from agent
 * - 'interruption': () - When conversation is interrupted
 * - 'clientToolCall': ({ tool_name: string, tool_call_id: string, parameters: object }) - Tool call request
 * - 'disconnected': ({ code: number, reason: string }) - When session disconnects
 */
export class GeminiConversation extends EventEmitter implements Conversation {
	private session: Session | null = null;
	private isConnected = false;
	private config: GeminiSessionConfig;
	private genAI: GoogleGenAI;

	constructor(config: GeminiSessionConfig) {
		super();
		this.config = config;
		this.genAI = new GoogleGenAI({ apiKey: CONFIG.GEMINI_API_KEY });
	}

	async connect(): Promise<void> {
		return new Promise((resolve, reject) => {
			try {
				this.genAI.live
					.connect({
						model: GEMINI_LIVE_MODEL,
						config: {
							responseModalities: [Modality.AUDIO],
							systemInstruction: this.config.systemInstruction,
							tools: this.config.tools,
							speechConfig: {
								voiceConfig: {
									prebuiltVoiceConfig: {
										voiceName: 'Aoede',
									},
								},
							},
						},
						callbacks: {
							onopen: () => {
								console.log('[Gemini] Connected to Gemini Live API');
								this.isConnected = true;
								this.emit('ready', {});
								resolve();
							},
							onmessage: (message: LiveServerMessage) => {
								this.handleMessage(message);
							},
							onerror: (error: ErrorEvent) => {
								console.error('[Gemini] WebSocket error:', error);
								this.isConnected = false;
								reject(new Error('Gemini WebSocket error occurred'));
							},
							onclose: (event: CloseEvent) => {
								console.log(
									`[Gemini] Connection closed: ${event.code} - ${event.reason}`,
								);
								this.isConnected = false;
								this.emit('disconnected', {
									code: event.code,
									reason: event.reason,
								});
							},
						},
					})
					.then((session) => {
						this.session = session;
					})
					.catch(reject);
			} catch (error) {
				reject(error);
			}
		});
	}

	sendAudio(audioBuffer: Buffer | Uint8Array): void {
		if (!this.isConnected || !this.session) {
			console.warn('[Gemini] Cannot send audio: session not connected');
			return;
		}

		try {
			const buf = Buffer.isBuffer(audioBuffer)
				? audioBuffer
				: Buffer.from(audioBuffer);
			const audioBase64 = buf.toString('base64');

			this.session.sendRealtimeInput({
				media: {
					mimeType: 'audio/pcm;rate=16000',
					data: audioBase64,
				},
			});
		} catch (error) {
			console.error('[Gemini] Failed to send audio:', error);
		}
	}

	sendUserMessage(text: string): void {
		if (!this.session) {
			console.warn('[Gemini] Cannot send message: session not connected');
			return;
		}

		this.session
			.send({ text, endOfTurn: true })
			.catch((error) => console.error('[Gemini] Failed to send message:', error));
	}

	sendUserActivity(): void {
		// Gemini Live API has built-in VAD, no need to send activity signals
	}

	sendToolResponse(toolCallId: string, result: string): void {
		if (!this.session) {
			console.warn('[Gemini] Cannot send tool response: session not connected');
			return;
		}

		this.session
			.send({
				toolResponse: {
					functionResponses: [
						{
							id: toolCallId,
							response: { result },
						},
					],
				},
			})
			.catch((error) =>
				console.error('[Gemini] Failed to send tool response:', error),
			);
	}

	async disconnect(): Promise<void> {
		if (this.session) {
			this.isConnected = false;
			try {
				this.session.close();
			} catch (error) {
				console.error('[Gemini] Error closing session:', error);
			}
			this.session = null;
		}
	}

	isSessionActive(): boolean {
		return this.isConnected && this.session !== null;
	}

	private handleMessage(message: LiveServerMessage): void {
		// Handle text responses
		if (message.serverContent?.modelTurn?.parts) {
			for (const part of message.serverContent.modelTurn.parts) {
				if (part.text) {
					console.log('[Gemini] Agent text response:', part.text);
					this.emit('agentResponse', { agent_response: part.text });
				}

				if (part.inlineData?.data) {
					// Audio data received
					this.emit('agentAudio', {
						audio_base_64: part.inlineData.data,
					});
				}
			}
		}

		// Handle tool calls
		if (message.toolCall?.functionCalls) {
			for (const functionCall of message.toolCall.functionCalls) {
				console.log('[Gemini] Tool call received:', functionCall.name);
				this.emit('clientToolCall', {
					tool_name: functionCall.name,
					tool_call_id: functionCall.id,
					parameters: functionCall.args,
				});
			}
		}

		// Handle interruption
		if (message.serverContent?.interrupted) {
			console.log('[Gemini] Conversation interrupted');
			this.emit('interruption', {});
		}

		// Handle turn completion
		if (message.serverContent?.turnComplete) {
			console.log('[Gemini] Turn complete');
		}
	}
}

export function createGameEndingToolDeclaration(
	toolName: string,
	description: string,
): Tool {
	const functionDeclaration: FunctionDeclaration = {
		name: toolName,
		description: description,
	};

	return {
		functionDeclarations: [functionDeclaration],
	};
}
