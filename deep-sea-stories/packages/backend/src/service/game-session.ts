import type {
	FishjamAgent,
	FishjamClient,
	Peer,
	PeerId,
	RoomId,
} from '@fishjam-cloud/js-server-sdk';
import type { Story } from '../types.js';
import {
	FISHJAM_AGENT_OPTIONS,
	AGENT_CLIENT_TOOL_INSTRUCTIONS,
	CONFIG,
} from '../config.js';
import { AudioStreamingOrchestrator } from './audio-streaming-orchestrator.js';
import { NoPeersConnectedError } from '../domain/errors.js';
import { ClientTools } from '@elevenlabs/elevenlabs-js/api/resources/conversationalAi/conversation/ClientTools.js';
import { Conversation } from '@elevenlabs/elevenlabs-js/api/resources/conversationalAi/conversation/Conversation.js';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js/Client.js';
import type {
	WebSocketFactory,
	WebSocketInterface,
} from '@elevenlabs/elevenlabs-js/api/resources/conversationalAi/conversation/interfaces/WebSocketInterface.js';
import { WebSocket } from 'ws';
import { getInstructionsForStory } from '../utils.js';
import { roomService } from './room.js';
import { notifierService } from './notifier.js';
import { FishjamAudioInterface } from './fishjam-audio-interface.js';
class MyWebSocketFactory implements WebSocketFactory {
	create(url: string, options?: any): WebSocketInterface {
		options = options || {};
		const apiKey = CONFIG.ELEVENLABS_API_KEY || options.apiKey;
		options.headers = {
			...options.headers,
			'xi-api-key': apiKey,
			'User-Agent': 'Deep-Sea-Stories-Backend/1.0.0',
		};
		console.log('Creating WebSocket with options:', options);
		console.log('Connecting to WebSocket URL:', url);
		const ws = new WebSocket(url, options);
		ws.on('error', (err) => {
			console.error('WebSocket error:', err);
		})
		return ws;
	}
}

export class GameSession {
	private roomId: RoomId;
	private story: Story | undefined;
	private peers: Peer[];
	private connectedPeers: Set<PeerId>;
	private peerNames: Map<PeerId, string>;
	private fishjamAgent: FishjamAgent | undefined;
	private fishjamAgentId: PeerId | undefined;
	private sharedConversation: Conversation | undefined;
	private audioOrchestrator: AudioStreamingOrchestrator | undefined;
	private agentId: string | undefined;
	private gameEndingToolId: string | undefined;
	private endingRoom = false;
	private elevenLabs: ElevenLabsClient = new ElevenLabsClient({
		apiKey: CONFIG.ELEVENLABS_API_KEY,
	});

	constructor(roomId: RoomId) {
		this.roomId = roomId;
		this.story = undefined;
		this.peers = [];
		this.connectedPeers = new Set<PeerId>();
		this.sharedConversation = undefined;
		this.peerNames = new Map<PeerId, string>();
	}

	getStory(): Story | undefined {
		return this.story;
	}

	getPeers(): Peer[] {
		return this.peers;
	}

	getConnectedPeers(): PeerId[] {
		return Array.from(this.connectedPeers);
	}

	getFishjamAgent(): {
		fishjamAgent: FishjamAgent | undefined;
		peerId: PeerId | undefined;
	} {
		return {
			fishjamAgent: this.fishjamAgent,
			peerId: this.fishjamAgentId,
		};
	}

	setStory(story: Story | undefined) {
		this.story = story;
	}

	async createPeer(
		fishjam: FishjamClient,
		name: string,
	): Promise<{ peer: Peer; peerToken: string }> {
		const { peer, peerToken } = await fishjam.createPeer(this.roomId);
		this.peers.push(peer);
		this.peerNames.set(peer.id, name);

		return { peer, peerToken };
	}

	getPeerName(peerId: PeerId): string | undefined {
		return this.peerNames.get(peerId);
	}

	setConnectedPeer(peerId: PeerId) {
		this.connectedPeers.add(peerId);
	}

	removeConnectedPeer(peerId: PeerId) {
		this.connectedPeers.delete(peerId);
	}

	async createFishjamAgent(fishjam: FishjamClient) {
		const { agent, peer } = await fishjam.createAgent(
			this.roomId,
			FISHJAM_AGENT_OPTIONS,
			{
				onError: (event: Event) => {
					console.log(
						`Fishjam Agent for room: ${this.roomId} encountered an error event:`,
						event,
					);
				},
				onClose: (code: number, reason: string) => {
					console.log(
						`Fishjam Agent for room: ${this.roomId} closed with code: ${code}, reason: ${reason}`,
					);
				},
			},
		);

		this.fishjamAgent = agent;
		this.fishjamAgentId = peer.id;
	}

	async startGame(story: Story): Promise<void> {
		this.setStory(story);

		if (this.connectedPeers.size === 0) {
			throw new NoPeersConnectedError(this.roomId);
		}

		console.log(
			`Starting game for ${this.connectedPeers.size} connected peers in room ${this.roomId}`,
		);

		console.log(
			`[GameSession] Creating shared AI session for room ${this.roomId}`,
		);

		this.setupAudioStreaming();

		try {
			const toolId = await this.ensureGameEndingTool();

			const agentId = await this.createAgent(story, toolId);
			this.agentId = agentId;

			const clientTools = new ClientTools();
			clientTools.register('game-ending', async () => {
				await this.gameEndingHandler();
			});

			const AudioInterface = new FishjamAudioInterface(
				this.fishjamAgent!,
				this.audioOrchestrator!,
			);

			const conversation = new Conversation({
				client: this.elevenLabs,
				agentId: agentId,
				audioInterface: AudioInterface,
				clientTools: clientTools,
				requiresAuth: false,
				webSocketFactory: new MyWebSocketFactory(),
			});
			await conversation.startSession();

			this.sharedConversation = conversation;

			console.log(
				`[GameSession] Shared AI conversation created for room ${this.roomId}`,
			);
		} catch (error) {
			console.error(
				`Failed to create shared AI session for room ${this.roomId}:`,
				error,
			);
			throw error;
		}
	}

	async startGameForPeer(peerId: PeerId): Promise<void> {
		console.log(
			`Peer ${peerId} joined active game in room ${this.roomId} (using shared session)`,
		);

		if (this.audioOrchestrator) {
			this.audioOrchestrator.addPeer(peerId);
		} else {
			console.warn(
				`No audio orchestrator found when peer ${peerId} joined room ${this.roomId}`,
			);
		}
	}

	private setupAudioStreaming(): void {
		if (!this.fishjamAgent) {
			console.error(
				`Cannot setup audio streaming: missing fishjam agent ${this.roomId}`,
			);
			return;
		}

		this.audioOrchestrator = new AudioStreamingOrchestrator(
			this.fishjamAgent,
			this.connectedPeers,
		);
	}

	async stopGame(): Promise<void> {
		if (this.sharedConversation) {
			try {
				await this.sharedConversation.endSession();
			} catch (error) {
				console.error(`Error closing session for room ${this.roomId}:`, error);
			}
		}

		if (this.agentId) {
			try {
				await this.elevenLabs.conversationalAi.agents.delete(this.agentId);
				console.log(
					`Deleted ElevenLabs agent ${this.agentId} for room ${this.roomId}`,
				);
			} catch (error) {
				console.error(
					`Error deleting ElevenLabs agent ${this.agentId} for room ${this.roomId}:`,
					error,
				);
			}
			this.agentId = undefined;
		}

		this.sharedConversation = undefined;
		this.setStory(undefined);
		console.log(`Stopped game for room ${this.roomId}`);

		notifierService.emitNotification({
			type: 'gameEnded' as const,
			timestamp: Date.now(),
		});
		console.log(`Stopped game for room ${this.roomId}`);
	}

	private async createAgent(story: Story, toolId: string): Promise<string> {
		const instructions = getInstructionsForStory(story);

		console.log(
			`Creating ElevenLabs agent for story "${story.title}" (ID: ${story.id})`,
		);

		const prompt = { prompt: instructions, toolIds: [toolId] };

		const config = {
			conversationConfig: {
				agent: {
					firstMessage: 'Welcome to deep-sea-stories!',
					language: 'en',
					prompt,
				},
			},
		};

		const { agentId } =
			await this.elevenLabs.conversationalAi.agents.create(config);
		return agentId;
	}

	private async ensureGameEndingTool(): Promise<string> {
		if (this.gameEndingToolId) {
			return this.gameEndingToolId;
		}

		const tools = await this.elevenLabs.conversationalAi.tools.list();
		const existingTool = (tools.tools ?? []).find(
			(tool) =>
				tool.toolConfig.type === 'client' &&
				tool.toolConfig.name === 'game-ending',
		);

		if (existingTool?.id) {
			this.gameEndingToolId = existingTool.id;
			return this.gameEndingToolId;
		}

		const createdTool = await this.elevenLabs.conversationalAi.tools.create({
			toolConfig: {
				type: 'client',
				name: 'game-ending',
				description: AGENT_CLIENT_TOOL_INSTRUCTIONS,
			},
		});

		this.gameEndingToolId = createdTool.id;
		return this.gameEndingToolId;
	}

	private async gameEndingHandler() {
		if (this.endingRoom) {
			return;
		}
		this.endingRoom = true;

		if (!roomService.isGameActive(this.roomId)) {
			this.endingRoom = false;
			return;
		}

		try {
			await this.stopGame();
			console.log(
				`Game session for room ${this.roomId} ended after game-ending tool call`,
			);
		} catch (error) {
			console.error(
				`Failed to stop game for room ${this.roomId} after game-ending tool call:`,
				error,
			);
		} finally {
			this.endingRoom = false;
		}
	}

	async removePeerFromGame(peerId: PeerId): Promise<void> {
		if (this.audioOrchestrator) {
			this.audioOrchestrator.removePeer(peerId);
		}

		if (this.connectedPeers.has(peerId)) {
			this.connectedPeers.delete(peerId);
		}

		if (this.connectedPeers.size === 0) {
			await this.stopGame();
			console.log(
				`No more connected peers in room ${this.roomId}. Game session stopped.`,
			);
			return;
		}

		console.log(
			`Peer ${peerId} removed from game in room ${this.roomId} (shared session maintained)`,
		);
	}
}
