import {
	GAME_TIME_LIMIT_SECONDS,
	ROOM_PLAYERS_LIMIT,
} from '@deep-sea-stories/common';
import {
	type FishjamClient,
	type Peer,
	type PeerId,
	PeerNotFoundException,
	type RoomId,
} from '@fishjam-cloud/js-server-sdk';
import type { VoiceAgentApi } from '../agent/api.js';
import { GeminiApi } from '../agent/gemini/api.js';
import { CONFIG, FISHJAM_AGENT_OPTIONS } from '../config.js';
import { AudioStreamingOrchestrator } from '../service/audio-streaming-orchestrator.js';
import type { NotifierService } from '../service/notifier.js';
import type { Story } from '../types.js';
import { GameSession } from './session.js';
import { GameRoomFullError } from '../domain/errors.js';

type Player = {
	name: string;
};

export class GameRoom {
	private fishjamClient: FishjamClient;
	private notifierService: NotifierService;
	private roomId: RoomId;
	private story?: Story;
	private players: Map<PeerId, Player>;
	private gameStarted: boolean = false;
	private gameSession: GameSession | null = null;
	private voiceAgentApi: VoiceAgentApi;
	private gameTimeoutId: NodeJS.Timeout | null = null;

	constructor(
		fishjamClient: FishjamClient,
		notifierService: NotifierService,
		roomId: RoomId,
	) {
		this.fishjamClient = fishjamClient;
		this.notifierService = notifierService;
		this.roomId = roomId;
		this.story = undefined;
		this.players = new Map();

		this.voiceAgentApi = new GeminiApi({
			apiKey: CONFIG.GEMINI_API_KEY,
			vertexai: CONFIG.GOOGLE_GENAI_USE_VERTEXAI,
			project: CONFIG.GOOGLE_CLOUD_PROJECT,
			location: CONFIG.GOOGLE_CLOUD_LOCATION,
			httpOptions: { apiVersion: 'v1alpha' },
		});
	}

	getStory(): Story | undefined {
		return this.story;
	}

	setStory(story: Story | undefined) {
		this.story = story;
	}

	getGameSession() {
		return this.gameSession ?? undefined;
	}

	async addPlayer(name: string): Promise<{ peer: Peer; peerToken: string }> {
		if (this.players.size >= ROOM_PLAYERS_LIMIT) {
			throw new GameRoomFullError();
		}
		const { peer, peerToken } = await this.fishjamClient.createPeer(
			this.roomId,
		);

		this.players.set(peer.id, { name });

		this.connectPlayer(peer.id);

		return { peer, peerToken };
	}

	async removePlayer(peerId: PeerId): Promise<string | null> {
		const player = this.players.get(peerId);
		this.players.delete(peerId);

		if (this.gameSession) {
			this.gameSession.removePlayer(peerId);
		}

		try {
			await this.fishjamClient.deletePeer(this.roomId, peerId);
		} catch (e) {
			if (!(e instanceof PeerNotFoundException)) {
				throw e;
			}
		}

		console.log('Player %s removed from game room %s', peerId, this.roomId);

		if (this.players.size === 0) {
			await this.stopGame();
		}

		return player?.name ?? null;
	}

	connectPlayer(peerId: PeerId) {
		const player = this.players.get(peerId);
		if (!player) return null;

		this.gameSession?.addPlayer(peerId);

		return player.name;
	}

	getPlayerName(peerId: PeerId): string | undefined {
		return this.players.get(peerId)?.name;
	}

	async startGame() {
		if (!this.story) {
			console.warn(
				'Attempted to start game without selected story for room %s',
				this.roomId,
			);
			return;
		}

		if (this.gameStarted) {
			console.log(`Game is already starting or active for room ${this.roomId}`);
			return;
		}

		this.gameStarted = true;

		const voiceAgentSession = await this.voiceAgentApi.createAgentSession({
			story: this.story,
			onEndGame: () => this.stopGame(true),
			gameTimeLimitSeconds: GAME_TIME_LIMIT_SECONDS,
			onTranscription: (transcription) => {
				this.notifierService.emitNotification(this.roomId, {
					type: 'transcription',
					text: transcription,
					timestamp: Date.now(),
				});
			},
		});

		const { agent: fishjamAgent, agentId: fishjamAgentId } =
			await this.createFishjamAgent();

		const audioOrchestrator = new AudioStreamingOrchestrator(
			voiceAgentSession,
			fishjamAgent,
			this.notifierService,
			this.roomId,
		);

		this.gameSession = new GameSession(
			this.roomId,
			fishjamAgentId,
			this.story,
			audioOrchestrator,
			this.notifierService,
		);

		console.log(
			`Starting game for ${this.players.size} players in room ${this.roomId}`,
		);

		console.log(`Creating shared AI session for room ${this.roomId}`);

		await this.gameSession.startGame();

		const promises = Array.from(this.players.keys()).map((peerId) =>
			this.gameSession?.addPlayer(peerId),
		);

		await Promise.all(promises);

		this.notifierService.emitNotification(this.roomId, {
			type: 'gameStarted' as const,
			timestamp: Date.now(),
		});
		this.gameTimeoutId = setTimeout(async () => {
			console.log(`⏰ Game time limit reached for room ${this.roomId}`);
			try {
				await this.gameSession?.announceTimeExpired();
			} catch (e) {
				console.error('Error announcing time expired:', e);
			}
		}, GAME_TIME_LIMIT_SECONDS * 1000);
	}

	async stopGame(wait: boolean = false) {
		console.log('Stopping game room %s', this.roomId);
		if (this.gameTimeoutId) {
			clearTimeout(this.gameTimeoutId);
			this.gameTimeoutId = null;
		}

		if (this.gameSession) {
			await this.gameSession.stopGame(wait);
			try {
				await this.fishjamClient.deletePeer(
					this.roomId,
					this.gameSession.agentId,
				);
				this.gameSession = null;
			} catch (e) {
				if (!(e instanceof PeerNotFoundException)) throw e;
			}
		}

		this.story = undefined;

		this.notifierService.emitNotification(this.roomId, {
			type: 'gameEnded' as const,
			timestamp: Date.now(),
		});

		this.gameStarted = false;
		console.log(`Stopped game for room ${this.roomId}`);
	}

	private async createFishjamAgent() {
		const { agent, peer } = await this.fishjamClient.createAgent(
			this.roomId,
			FISHJAM_AGENT_OPTIONS,
			{
				onError: (event: Event) => {
					console.log(
						`Fishjam Agent for room: ${this.roomId} encountered an error event:`,
						event,
					);
				},
			},
		);

		await new Promise((resolve) => setTimeout(resolve, 500));
		return { agent, agentId: peer.id };
	}
}
