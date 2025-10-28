import type {
	FishjamAgent,
	FishjamClient,
	Peer,
	PeerId,
	RoomId,
} from '@fishjam-cloud/js-server-sdk';
import type { Story, Conversation } from '../types.js';
import {
	FISHJAM_AGENT_OPTIONS,
	CONFIG,
	AGENT_CLIENT_TOOL_INSTRUCTIONS,
} from '../config.js';
import { AudioStreamingOrchestrator } from './audio-streaming-orchestrator.js';
import { NoPeersConnectedError } from '../domain/errors.js';
import {
	ElevenLabsConversation,
	elevenLabs,
} from './elevenlabs-conversation.js';
import { getInstructionsForStory } from '../utils.js';
import { roomService } from './room.js';
import { notifierService } from './notifier.js';

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

	constructor(roomId: RoomId) {
		this.roomId = roomId;
		this.story = undefined;
		this.peers = [];
		this.connectedPeers = new Set<PeerId>();
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

		try {
			const toolId = await this.ensureGameEndingTool();

			const agentId = await this.createAgent(story, toolId);
			this.agentId = agentId;

			const session = new ElevenLabsConversation(
				agentId,
				CONFIG.ELEVENLABS_API_KEY,
			);
			await session.connect();

			this.registerClientToolHandler(session);

			this.sharedConversation = session;
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

		this.setupAudioStreaming();
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

		if (!this.sharedConversation) {
			console.error(
				`Cannot setup audio streaming: missing shared conversation for room ${this.roomId}`,
			);
			return;
		}

		this.audioOrchestrator = new AudioStreamingOrchestrator(
			this.fishjamAgent,
			this.connectedPeers,
			this.sharedConversation,
		);

		this.audioOrchestrator.setupAudioPipelines();
	}

	async stopGame(): Promise<void> {
		if (this.sharedConversation) {
			try {
				await (this.sharedConversation as ElevenLabsConversation).disconnect();
			} catch (error) {
				console.error(`Error closing session for room ${this.roomId}:`, error);
			}
		}

		if (this.agentId) {
			try {
				await elevenLabs.conversationalAi.agents.delete(this.agentId);
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

		const { agentId } = await elevenLabs.conversationalAi.agents.create(config);
		return agentId;
	}

	private async ensureGameEndingTool(): Promise<string> {
		if (this.gameEndingToolId) {
			return this.gameEndingToolId;
		}

		const tools = await elevenLabs.conversationalAi.tools.list();
		const existingTool = (tools.tools ?? []).find(
			(tool) =>
				tool.toolConfig.type === 'client' &&
				tool.toolConfig.name === 'game-ending',
		);

		if (existingTool?.id) {
			this.gameEndingToolId = existingTool.id;
			return this.gameEndingToolId;
		}

		const createdTool = await elevenLabs.conversationalAi.tools.create({
			toolConfig: {
				type: 'client',
				name: 'game-ending',
				description: AGENT_CLIENT_TOOL_INSTRUCTIONS,
			},
		});

		this.gameEndingToolId = createdTool.id;
		return this.gameEndingToolId;
	}

	private registerClientToolHandler(session: ElevenLabsConversation): void {
		session.on('clientToolCall', async (clientToolCall: unknown) => {
			const call =
				clientToolCall && typeof clientToolCall === 'object'
					? (clientToolCall as Record<string, unknown>)
					: undefined;
			const toolName =
				typeof call?.tool_name === 'string' ? call.tool_name : undefined;
			if (!toolName || toolName !== 'game-ending') {
				return;
			}

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
		});
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
