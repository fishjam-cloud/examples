import { CONFIG } from "../config.js";
import WebSocket from 'ws';
import { EventEmitter } from 'events';


interface ConversationInitiationMetadataEvent {
    conversation_id: string;
    agent_output_audio_format: string;
    user_input_audio_format: string;
}

interface ConversationConfig {
    agent_prompt?: string;
    first_message?: string;
    language?: string;
    voice_id?: string;
    [key: string]: any;
}

interface AgentCreateRequest {
    conversation_config: ConversationConfig;
    platform_settings?: {
        [key: string]: any;
    };
    name?: string;
    tags?: string[];
}

export interface AgentId {
    agent_id: string;
}

class ElevenLabs {
    private apiKey: string;
    private baseUrl: string = 'https://api.elevenlabs.io';
    
    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    async createAgent(
        conversationConfig: ConversationConfig,
        options?: {
            name?: string;
            tags?: string[];
            platformSettings?: { [key: string]: any };
        }
    ): Promise<AgentId> {
        try {
            const requestBody: AgentCreateRequest = {
                conversation_config: conversationConfig,
                ...(options?.name && { name: options.name }),
                ...(options?.tags && { tags: options.tags }),
                ...(options?.platformSettings && { platform_settings: options.platformSettings })
            };

            const response = await fetch(`${this.baseUrl}/v1/convai/agents/create`, {
                method: 'POST',
                headers: {
                    'xi-api-key': this.apiKey,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`ElevenLabs API error: ${response.status} ${response.statusText} - ${errorText}`);
            }

            return await response.json() as AgentId;
        } catch (error) {
            throw new Error(`Failed to create ElevenLabs agent: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
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
export class ElevenLabsConversation extends EventEmitter {
    private ws: WebSocket | null = null;
    private conversationId: string | null = null;
    private isConnected = false;
    private audioFormat: string | null = null;
    private inputFormat: string | null = null;

    constructor(
        private agentId: string,
        private apiKey: string,
        private baseUrl: string = 'wss://api.elevenlabs.io'
    ) {
        super();
    }

    /**
     * Start a conversation session with the ElevenLabs agent
     */
    async connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                const wsUrl = `${this.baseUrl}/v1/convai/conversation?agent_id=${this.agentId}`;
                
                this.ws = new WebSocket(wsUrl, {
                    headers: {
                        'xi-api-key': this.apiKey,
                        'User-Agent': 'Deep-Sea-Stories-Backend/1.0.0',
                    },
                });

                this.ws.on('open', () => {
                    console.log('Connected to ElevenLabs WebSocket');
                    this.isConnected = true;
                    
                    this.sendMessage({
                        type: 'conversation_initiation_client_data',
                        conversation_config_override: {}
                    });
                    
                    resolve();
                });

                this.ws.on('message', (data: Buffer) => {
                    try {
                        const message = JSON.parse(data.toString());
                        this.handleMessage(message);
                    } catch (error) {
                        console.error('Failed to parse WebSocket message:', error);
                    }
                });

                this.ws.on('close', (code: number, reason: Buffer) => {
                    console.log(`ElevenLabs WebSocket connection closed: ${code} - ${reason.toString()}`);
                    this.isConnected = false;
                    this.emit('disconnected', { code, reason: reason.toString() });
                });

                this.ws.on('error', (error) => {
                    console.error('ElevenLabs WebSocket error:', error);
                    this.isConnected = false;
                    reject(error);
                });

            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Send raw audio data to ElevenLabs
     * @param audioBuffer Raw audio data as Buffer
     */
    sendAudio(audioBuffer: Buffer): void {
        if (!this.isConnected || !this.ws) {
            console.warn('Cannot send audio: WebSocket not connected');
            return;
        }

        try {
            const audioBase64 = audioBuffer.toString('base64');
            
            this.sendMessage({
                user_audio_chunk: audioBase64
            });
        } catch (error) {
            console.error('Failed to send audio to ElevenLabs:', error);
        }
    }

    sendUserMessage(text: string): void {
        this.sendMessage({
            type: 'user_message',
            text: text
        });
    }

    sendContextualUpdate(text: string): void {
        this.sendMessage({
            type: 'contextual_update',
            text: text
        });
    }

    sendUserActivity(): void {
        this.sendMessage({
            type: 'user_activity'
        });
    }

    sendClientToolResult(toolCallId: string, result: string, isError: boolean = false): void {
        this.sendMessage({
            type: 'client_tool_result',
            tool_call_id: toolCallId,
            result: result,
            is_error: isError
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

    private sendMessage(message: any): void {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        }
    }

    private handleMessage(message: any): void {
        switch (message.type) {
            case 'conversation_initiation_metadata':
                const metadata: ConversationInitiationMetadataEvent = message.conversation_initiation_metadata_event;
                this.conversationId = metadata?.conversation_id;
                this.audioFormat = metadata?.agent_output_audio_format;
                this.inputFormat = metadata?.user_input_audio_format;
                console.log('Conversation initiated:', {
                    conversationId: this.conversationId,
                    audioFormat: this.audioFormat,
                    inputFormat: this.inputFormat
                });
                this.emit('ready', { 
                    conversationId: this.conversationId,
                    audioFormat: this.audioFormat,
                    inputFormat: this.inputFormat
                });
                break;
                
            case 'agent_response':
                console.log('Agent response:', message.agent_response_event?.agent_response);
                this.emit('agentResponse', message.agent_response_event);
                break;
                
            case 'user_transcript':
                console.log('User transcript:', message.user_transcription_event?.user_transcript);
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
                    event_id: message.ping_event?.event_id
                });
                break;
                
            case 'vad_score':
                this.emit('vadScore', message.vad_score_event);
                break;
                
            case 'internal_tentative_agent_response':
                this.emit('tentativeResponse', message.tentative_agent_response_internal_event);
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

export const elevenLabs = new ElevenLabs(CONFIG.ELEVENLABS_API_KEY);
