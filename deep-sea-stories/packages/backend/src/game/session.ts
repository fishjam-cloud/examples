import type { PeerId, RoomId } from '@fishjam-cloud/js-server-sdk';
import type { AudioStreamingOrchestrator } from '../service/audio-streaming-orchestrator.js';
import type { NotifierService } from '../service/notifier.js';
import type { Story } from '../types.js';

type MuteSource = 'manual' | 'system';

export class GameSession {
	readonly story: Story;
	readonly roomId: RoomId;
	readonly agentId: PeerId;

	private readonly audioOrchestrator: AudioStreamingOrchestrator;
	private readonly notifierService: NotifierService;
	private isAiAgentMuted: boolean = false;
	private manualMute: boolean = false;
	private systemMute: boolean = false;

	constructor(
		roomId: RoomId,
		agentId: PeerId,
		story: Story,
		audioOrchestrator: AudioStreamingOrchestrator,
		notifierService: NotifierService,
	) {
		this.roomId = roomId;
		this.agentId = agentId;
		this.story = story;
		this.audioOrchestrator = audioOrchestrator;
		this.notifierService = notifierService;
	}

	addPlayer(peerId: PeerId) {
		this.audioOrchestrator.addPeer(peerId);
	}

	removePlayer(peerId: PeerId) {
		this.audioOrchestrator.removePeer(peerId);
	}

	setAiAgentMuted(muted: boolean, options?: { source?: MuteSource }) {
		const source = options?.source ?? 'manual';

		if (source === 'manual') {
			this.manualMute = muted;
			this.systemMute = false;
		} else {
			this.systemMute = muted;
		}

		this.updateMuteState();
	}

	private updateMuteState() {
		const nextState = this.manualMute || this.systemMute;
		this.applyMuteState(nextState);
	}

	private applyMuteState(muted: boolean) {
		if (this.isAiAgentMuted === muted) return;
		this.isAiAgentMuted = muted;
		this.audioOrchestrator.setMuted(muted);

		this.notifierService.emitNotification(this.roomId, {
			type: 'aiAgentMutedStatusChanged' as const,
			muted: muted,
			timestamp: Date.now(),
		});

		console.log(
			`AI agent in room ${this.roomId} is now ${muted ? 'muted' : 'unmuted'}`,
		);
	}

	isAiAgentMut(): boolean {
		return this.isAiAgentMuted;
	}

	async startGame() {
		await this.audioOrchestrator.start();
	}

	async announceTimeExpired() {
		await this.audioOrchestrator.voiceAgentSession.announceTimeExpired();
	}

	async stopGame(wait: boolean = false) {
		await this.audioOrchestrator.shutdown(wait);
	}
}
