import { CONFIG } from '../config.js';
import { EventEmitter } from 'node:events';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import type { Conversation } from '../types.js';

interface ConversationInitiationMetadataEvent {
	conversation_id: string;
	agent_output_audio_format: string;
	user_input_audio_format: string;
}

interface ElevenLabsMessage {
	type: string;
	conversation_initiation_metadata_event?: ConversationInitiationMetadataEvent;
	agent_response_event?: {
		agent_response?: string;
	};
	user_transcription_event?: {
		user_transcript?: string;
	};
	audio_event?: unknown;
	interruption_event?: unknown;
	ping_event?: {
		event_id?: string;
	};
	vad_score_event?: unknown;
	tentative_agent_response_internal_event?: unknown;
	client_tool_call?: unknown;
}

export interface AgentId {
	agent_id: string;
}

/**
 * WebSocket-based conversation with ElevenLabs for real-time audio streaming
 * https://elevenlabs.io/docs/agents-platform/api-reference/agents-platform/websocket
 *
 * Events emitted:
 * - 'ready': ({ conversationId, audioFormat, inputFormat }) - When conversation is ready
 * - 'agentResponse': (AgentResponseEvent) - Text response from agent
 * - 'userTranscript': (UserTranscriptEvent) - User speech transcription
 * - 'agentAudio': (AudioEvent) - Audio response from agent
 * - 'interruption': (InterruptionEvent) - When conversation is interrupted
 * - 'vadScore': (VadScoreEvent) - Voice activity detection score
 * - 'tentativeResponse': (TentativeAgentResponseEvent) - Tentative response
 * - 'clientToolCall': (ClientToolCall) - Client tool call request
 * - 'disconnected': ({ code, reason }) - When WebSocket disconnects
 */
export class ElevenLabsConversation
	extends EventEmitter
	implements Conversation
{
	private ws: WebSocket | null = null;
	private conversationId: string | null = null;
	private isConnected = false;
	private audioFormat: string | null = null;
	private inputFormat: string | null = null;
	private agentId: string;
	private apiKey: string;
	private baseUrl: string;

	constructor(
		agentId: string,
		apiKey: string,
		baseUrl: string = 'wss://api.elevenlabs.io',
	) {
		super();
		this.agentId = agentId;
		this.apiKey = apiKey;
		this.baseUrl = baseUrl;
	}

	/**
	 * Start a conversation session with the ElevenLabs agent
	 */
	async connect(): Promise<void> {
		return new Promise((resolve, reject) => {
			try {
				const wsUrl = `${this.baseUrl}/v1/convai/conversation?agent_id=${this.agentId}`;

				const wsOptions = {
					headers: {
						'xi-api-key': this.apiKey,
						'User-Agent': 'Deep-Sea-Stories-Backend/1.0.0',
					},
				};

				this.ws = new WebSocket(wsUrl, wsOptions as unknown as string[]);

				this.ws.addEventListener('open', () => {
					console.log('Connected to ElevenLabs WebSocket');
					this.isConnected = true;

					this.sendMessage({
						type: 'conversation_initiation_client_data',
						conversation_config_override: {},
					});

					resolve();
				});

				this.ws.addEventListener('message', (event) => {
					try {
						const message = JSON.parse(event.data.toString());
						this.handleMessage(message);
					} catch (error) {
						console.error('Failed to parse WebSocket message:', error);
					}
				});

				this.ws.addEventListener('close', (event) => {
					console.log(
						`ElevenLabs WebSocket connection closed: ${event.code} - ${event.reason}`,
					);
					this.isConnected = false;
					this.emit('disconnected', { code: event.code, reason: event.reason });
				});

				this.ws.addEventListener('error', (event) => {
					console.error('ElevenLabs WebSocket error:', event);
					this.isConnected = false;
					reject(new Error('WebSocket error occurred'));
				});
			} catch (error) {
				reject(error);
			}
		});
	}

	sendAudio(audioBuffer: Buffer): void {
		if (!this.isConnected || !this.ws) {
			console.warn('Cannot send audio: WebSocket not connected');
			return;
		}

		try {
			const audioBase64 = audioBuffer.toString('base64');

			this.sendMessage({
				user_audio_chunk: audioBase64,
			});
		} catch (error) {
			console.error('Failed to send audio to ElevenLabs:', error);
		}
	}

	sendUserMessage(text: string): void {
		this.sendMessage({
			type: 'user_message',
			text: text,
		});
	}

	sendContextualUpdate(text: string): void {
		this.sendMessage({
			type: 'contextual_update',
			text: text,
		});
	}

	sendUserActivity(): void {
		this.sendMessage({
			type: 'user_activity',
		});
	}

	sendClientToolResult(
		toolCallId: string,
		result: string,
		isError: boolean = false,
	): void {
		this.sendMessage({
			type: 'client_tool_result',
			tool_call_id: toolCallId,
			result: result,
			is_error: isError,
		});
	}

	async disconnect(): Promise<void> {
		if (this.ws) {
			this.isConnected = false;
			this.ws.close();
			this.ws = null;
		}
	}

	isSessionActive(): boolean {
		return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
	}

	private sendMessage(message: Record<string, unknown>): void {
		if (this.ws && this.ws.readyState === WebSocket.OPEN) {
			this.ws.send(JSON.stringify(message));
		}
	}

	private handleMessage(message: ElevenLabsMessage): void {
		switch (message.type) {
			case 'conversation_initiation_metadata': {
				const metadata = message.conversation_initiation_metadata_event;
				if (metadata) {
					this.conversationId = metadata.conversation_id;
					this.audioFormat = metadata.agent_output_audio_format;
					this.inputFormat = metadata.user_input_audio_format;
					console.log('Conversation initiated:', {
						conversationId: this.conversationId,
						audioFormat: this.audioFormat,
						inputFormat: this.inputFormat,
					});
					this.emit('ready', {
						conversationId: this.conversationId,
						audioFormat: this.audioFormat,
						inputFormat: this.inputFormat,
					});
				}
				break;
			}

			case 'agent_response':
				console.log(
					'Agent response:',
					message.agent_response_event?.agent_response,
				);
				this.emit('agentResponse', message.agent_response_event);
				break;

			case 'user_transcript':
				console.log(
					'User transcript:',
					message.user_transcription_event?.user_transcript,
				);
				this.emit('userTranscript', message.user_transcription_event);
				break;

			case 'audio':
				this.emit('agentAudio', message.audio_event);
				break;

			case 'interruption':
				console.log('Conversation interrupted');
				this.emit('interruption', message.interruption_event);
				break;

			case 'ping':
				console.log('Received ping, sending pong');
				this.sendMessage({
					type: 'pong',
					event_id: message.ping_event?.event_id,
				});
				break;

			case 'vad_score':
				this.emit('vadScore', message.vad_score_event);
				break;

			case 'internal_tentative_agent_response':
				this.emit(
					'tentativeResponse',
					message.tentative_agent_response_internal_event,
				);
				break;

			case 'client_tool_call':
				console.log('Client tool call:', message.client_tool_call);
				this.emit('clientToolCall', message.client_tool_call);
				break;

			case 'contextual_update':
				this.emit('contextualUpdate', message);
				break;

			default:
				console.log('Received unknown message type:', message.type);
				this.emit('message', message);
		}
	}

	getConversationId(): string | null {
		return this.conversationId;
	}

	getAudioFormat(): string | null {
		return this.audioFormat;
	}

	getInputFormat(): string | null {
		return this.inputFormat;
	}
}

export const elevenLabs = new ElevenLabsClient({
	apiKey: CONFIG.ELEVENLABS_API_KEY,
});
