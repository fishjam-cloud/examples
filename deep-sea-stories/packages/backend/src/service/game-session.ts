import type {
	FishjamAgent,
	FishjamClient,
	Peer,
	PeerId,
	RoomId,
} from '@fishjam-cloud/js-server-sdk';
import type { Story, VoiceAgentSessionManager } from '../types.js';
import { FISHJAM_AGENT_OPTIONS } from '../config.js';
import { AudioStreamingOrchestrator } from './audio-streaming-orchestrator.js';
import {
	NoPeersConnectedError,
	NoVoiceSessionManagerError,
} from '../domain/errors.js';
import { ElevenLabsSessionManager } from './elevenlabs-session.js';
import { notifierService } from './notifier.js';

export class GameSession {
	private roomId: RoomId;
	private story: Story | undefined;
	private peers: Peer[];
	private connectedPeers: Set<PeerId>;
	private peerNames: Map<PeerId, string>;
	private fishjamAgent: FishjamAgent | undefined;
	private fishjamAgentId: PeerId | undefined;
	private voiceSessionManager: VoiceAgentSessionManager | undefined;

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

	getVoiceSessionManager(): VoiceAgentSessionManager | undefined {
		return this.voiceSessionManager;
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

	setVoiceSessionManager(manager: VoiceAgentSessionManager) {
		this.voiceSessionManager = manager;
	}

	async startGame(story: Story): Promise<void> {
		this.setStory(story);

		if (this.connectedPeers.size === 0) {
			throw new NoPeersConnectedError(this.roomId);
		}

		console.log(
			`Starting game for ${this.connectedPeers.size} connected peers in room ${this.roomId}`,
		);

		const gameSession = new ElevenLabsSessionManager();
		this.setVoiceSessionManager(gameSession);

		const peerIds = Array.from(this.connectedPeers);
		await Promise.all(
			peerIds.map(async (peerId) => {
				try {
					await this.startGameForPeer(peerId);
				} catch (error) {
					console.error(
						`Failed to start game for peer ${peerId} in room ${this.roomId}:`,
						error,
					);
				}
			}),
		);
		this.setupAudioStreaming();

		notifierService.emitNotification({
			type: 'gameStarted' as const,
			timestamp: Date.now(),
		});
	}

	async startGameForPeer(peerId: PeerId): Promise<void> {
		if (!this.voiceSessionManager) {
			throw new NoVoiceSessionManagerError(this.roomId);
		}

		try {
			await this.voiceSessionManager.createSession(peerId, this.roomId);
			console.log(
				`Started game session for peer ${peerId} in room ${this.roomId}`,
			);
		} catch (error) {
			console.error(`Failed to start game session for peer ${peerId}:`, error);
			throw error;
		}
	}

	private setupAudioStreaming(): void {
		if (!this.fishjamAgent || !this.voiceSessionManager) {
			console.error(
				`Cannot setup audio streaming: missing agent or session manager for room ${this.roomId}`,
			);
			return;
		}

		const orchestrator = new AudioStreamingOrchestrator(
			this.fishjamAgent,
			this.voiceSessionManager,
			this.connectedPeers,
		);

		orchestrator.setupAudioPipelines();

		this.sendInitMessage();
	}

	private sendInitMessage(): void {
		const firstPeerId = this.connectedPeers.values().next().value;
		if (!firstPeerId) {
			console.error(
				`Cannot send init message: no connected peers in room ${this.roomId}`,
			);
			return;
		}

		if (!this.voiceSessionManager) {
			console.error(
				`Cannot send init message: missing session manager for room ${this.roomId}`,
			);
			return;
		}

		const anyAgentSession = this.voiceSessionManager.getSession(firstPeerId);
		if (!anyAgentSession) {
			console.error(
				`Cannot send init message: no session for peer ${firstPeerId} in room ${this.roomId}`,
			);
			return;
		}

		// Request the voice agent to explain the game rules; all players will hear it
		anyAgentSession.sendUserMessage(
			"The riddle master welcomes all players saying 'Welcome to Deep Sea Stories' and then reads the initial scenario or mystery to the guessers. ",
		);
	}

	async stopGame(): Promise<void> {
		this.voiceSessionManager?.cleanup();
		this.setStory(undefined);
		console.log(`Stopped game for room ${roomId}`);

		notifierService.emitNotification({
			type: 'gameEnded' as const,
			timestamp: Date.now(),
		});
		console.log(`Stopped game for room ${this.roomId}`);
	}

	async removePeerFromGame(peerId: PeerId): Promise<void> {
		if (this.voiceSessionManager) {
			await this.voiceSessionManager.deleteSession(peerId);
			console.log(`Removed peer ${peerId} from game in room ${this.roomId}`);
		}
	}
}
