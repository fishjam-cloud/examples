import type {
	AgentTrack,
	FishjamAgent,
	PeerId,
	RoomId,
} from '@fishjam-cloud/js-server-sdk';
import VAD, { type VADData } from 'node-vad';
import type { VoiceAgentSession } from '../agent/session.js';
import { VAD_DEBOUNCE_MS } from '../config.js';
import type { NotifierService } from './notifier.js';
import { BitrateEstimator } from '../bitrateEstimator.js';

export class AudioStreamingOrchestrator {
	readonly voiceAgentSession: VoiceAgentSession;
	private fishjamAgent: FishjamAgent;
	private fishjamTrack: AgentTrack;
	private vadStreams: Map<PeerId, NodeJS.ReadWriteStream>;
	private activeSpeaker: PeerId | null;
	private outputInterval?: NodeJS.Timeout | null;
	private isInputMuted: boolean = false;
	private roomId: RoomId;
	private notifierService: NotifierService;
	private vadTimeout: NodeJS.Timeout | null = null;
	private bitrateEstimator: BitrateEstimator;

	constructor(
		voiceAgentSession: VoiceAgentSession,
		fishjamAgent: FishjamAgent,
		notifierService: NotifierService,
		roomId: RoomId,
	) {
		this.voiceAgentSession = voiceAgentSession;
		this.fishjamAgent = fishjamAgent;
		this.vadStreams = new Map();
		this.activeSpeaker = null;
		this.roomId = roomId;
		this.notifierService = notifierService;
		this.bitrateEstimator = new BitrateEstimator('From Gemini', 3);

		this.fishjamTrack = fishjamAgent.createTrack({
			channels: 1,
			sampleRate: 24000,
			encoding: 'pcm16',
		});

		this.setupAudioPipelines();
	}

	addPeer(peerId: PeerId) {
		if (this.vadStreams.has(peerId)) return;
		this.vadStreams.set(peerId, this.initializeVADStream(peerId));
		console.log(`[Orchestrator] Initialized VAD stream for new peer ${peerId}`);
	}

	removePeer(peerId: PeerId): void {
		const vadStream = this.vadStreams.get(peerId);

		if (vadStream) {
			vadStream.unpipe();
			this.vadStreams.delete(peerId);
		}

		if (this.activeSpeaker === peerId) {
			console.log(
				`[Orchestrator] Active speaker ${peerId} left, releasing floor`,
			);
			this.activeSpeaker = null;

			this.notifierService.emitNotification(this.roomId, {
				type: 'VAD',
				peerId: null,
				timestamp: Date.now(),
			});
		}

		if (this.vadStreams.size === 0) {
			if (this.outputInterval) {
				clearInterval(this.outputInterval);
				this.outputInterval = null;
			}
			console.log(
				'[Orchestrator] Cleared silence keep-alive interval (no connected peers)',
			);
		}
	}

	setMuted(muted: boolean): void {
		this.isInputMuted = muted;
		console.log(
			`[Orchestrator] User audio input to AI is now ${muted ? 'blocked' : 'enabled'}`,
		);
	}

	async start() {
		await this.voiceAgentSession.open();
	}

	async shutdown(wait: boolean = false) {
		await this.voiceAgentSession.close(wait);

		for (const vadStream of this.vadStreams.values()) {
			vadStream.unpipe();
		}
		this.vadStreams.clear();

		if (this.outputInterval) {
			clearInterval(this.outputInterval);
			this.outputInterval = null;
		}

		if (this.fishjamAgent) {
			this.fishjamAgent.removeAllListeners('trackData');
			this.fishjamAgent.deleteTrack(this.fishjamTrack.id);
		}

		this.endVAD();
		if (this.vadTimeout) {
			clearTimeout(this.vadTimeout);
			this.vadTimeout = null;
		}

		this.bitrateEstimator.stop();

		console.log('[Orchestrator] Cleaned up all resources');
	}

	private initializeVADStream(peerId: PeerId) {
		const vadStream = VAD.createStream({
			mode: VAD.Mode.VERY_AGGRESSIVE,
			audioFrequency: 16000,
			debounceTime: VAD_DEBOUNCE_MS,
		});

		vadStream.on('data', (vadData: VADData) => {
			const { speech } = vadData;

			if (speech.state && this.activeSpeaker === null) {
				this.startVAD(peerId);
				console.log(
					`[Orchestrator] Active speaker set to peer ${peerId} (speech started)`,
				);
			}

			const isActiveSpeaker = this.activeSpeaker === peerId;

			if (!speech.state && this.activeSpeaker === peerId) {
				console.log(
					`[Orchestrator] Active speaker ${peerId} is now silent (speech ended after ${speech.duration}ms), releasing floor`,
				);
				this.endVAD();
			}

			if (isActiveSpeaker && this.vadTimeout) {
				clearTimeout(this.vadTimeout);
				this.vadTimeout = null;
			}

			if (!isActiveSpeaker || this.isInputMuted) {
				return;
			}

			try {
				this.voiceAgentSession.sendAudio(vadData.audioData);
			} catch (error) {
				console.error(
					`[Orchestrator] Error sending audio to AI voice agent for peer ${peerId}:`,
					error,
				);
			}

			if (speech.end) return;

			this.vadTimeout = setTimeout(() => {
				this.vadTimeout = null;
				this.endVAD();
			}, VAD_DEBOUNCE_MS);
		});

		return vadStream;
	}

	private setupAudioPipelines(): void {
		this.setupIncomingAudioPipeline();
		this.setupOutgoingAudioPipeline();
	}

	private setupIncomingAudioPipeline(): void {
		this.fishjamAgent.on('trackData', ({ peerId, data }) => {
			this.vadStreams.get(peerId)?.write(data);
		});
	}

	private startVAD(peerId: PeerId) {
		this.activeSpeaker = peerId;

		this.notifierService.emitNotification(this.roomId, {
			type: 'VAD',
			peerId: peerId,
			timestamp: Date.now(),
		});
	}

	private endVAD() {
		this.activeSpeaker = null;
		this.notifierService.emitNotification(this.roomId, {
			type: 'VAD',
			peerId: null,
			timestamp: Date.now(),
		});
	}

	private setupOutgoingAudioPipeline(): void {
		this.voiceAgentSession.registerInterruptionCallback(() => {
			console.log('[Orchestrator] Clearing audio queue due to interruption');

			this.fishjamAgent.interruptTrack(this.fishjamTrack.id);
		});

		this.voiceAgentSession.registerAgentAudioCallback((audio) => {
			this.bitrateEstimator.handleBuffer(audio);
			this.fishjamAgent.sendData(this.fishjamTrack.id, audio);
		});
	}
}
