import type {
	FishjamAgent,
	FishjamClient,
	Peer,
	PeerId,
	RoomId,
} from '@fishjam-cloud/js-server-sdk';
import type { Story } from '../types.js';
import { FISHJAM_AGENT_OPTIONS } from '../config.js';
import { AudioStreamingOrchestrator } from './audio-streaming-orchestrator.js';
import { NoPeersConnectedError } from '../domain/errors.js';
import { notifierService } from './notifier.js';
import { ElevenLabsSessionManager } from './elevenlabs-session.js';

export class GameSession {
	private roomId: RoomId;
	private story: Story | undefined;
	private peers: Peer[];
	private connectedPeers: Set<PeerId>;
	private peerNames: Map<PeerId, string>;
	private fishjamAgent: FishjamAgent | undefined;
	private fishjamAgentId: PeerId | undefined;
	private audioOrchestrator: AudioStreamingOrchestrator | undefined;
	private voiceAgentSession: ElevenLabsSessionManager | undefined;
	private isGameStarting: boolean = false;

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

	async startGame(): Promise<void> {
		if (this.isGameStarting || this.voiceAgentSession) {
			console.log(`Game is already starting or active for room ${this.roomId}`);
			return;
		}
		this.isGameStarting = true;

		if (this.connectedPeers.size === 0) {
			throw new NoPeersConnectedError(this.roomId);
		}

		console.log(
			`Starting game for ${this.connectedPeers.size} connected peers in room ${this.roomId}`,
		);

		console.log(
			`[GameSession] Creating shared AI session for room ${this.roomId}`,
		);

		this.voiceAgentSession = new ElevenLabsSessionManager(this.roomId);
		await this.voiceAgentSession.init();

		this.setupAudioStreaming();

		notifierService.emitNotification(this.roomId, {
			type: 'gameStarted' as const,
			timestamp: Date.now(),
		});
		this.isGameStarting = false;
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

		const sharedConversation = this.voiceAgentSession?.getSession();

		if (!sharedConversation) {
			console.error(
				`Cannot setup audio streaming: missing shared conversation for room ${this.roomId}`,
			);
			return;
		}

		this.audioOrchestrator = new AudioStreamingOrchestrator(
			this.fishjamAgent,
			this.connectedPeers,
			sharedConversation,
		);

		this.audioOrchestrator.setupAudioPipelines();
	}

	async stopGame(): Promise<void> {
		if (this.audioOrchestrator) {
			console.log(`Waiting for audio queue to drain for room ${this.roomId}`);
			await this.audioOrchestrator.waitForAudioQueueToDrain();
		}

		if (this.voiceAgentSession) {
			await this.voiceAgentSession.deleteSession();
			this.voiceAgentSession = undefined;
		}
		this.setStory(undefined);

		if (this.audioOrchestrator) {
			this.audioOrchestrator.shutdown();
			this.audioOrchestrator = undefined;
		}

		notifierService.emitNotification(this.roomId, {
			type: 'gameEnded' as const,
			timestamp: Date.now(),
		});
		console.log(`Stopped game for room ${this.roomId}`);
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
