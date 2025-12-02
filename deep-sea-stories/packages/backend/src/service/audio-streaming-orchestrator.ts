import type {
	AgentTrack,
	FishjamAgent,
	PeerId,
} from '@fishjam-cloud/js-server-sdk';
import VAD, { type VADData } from 'node-vad';
import type { VoiceAgentSession } from '../agent/session.js';
import { VAD_DEBOUNCE_MS } from '../config.js';

export class AudioStreamingOrchestrator {
	readonly voiceAgentSession: VoiceAgentSession;
	private fishjamAgent: FishjamAgent;
	private fishjamTrack: AgentTrack;
	private vadStreams: Map<PeerId, NodeJS.ReadWriteStream>;
	private activeSpeaker: PeerId | null;
	private lastOutgoingTs: number | null;
	private outputInterval?: NodeJS.Timeout | null;
	private isInputMuted: boolean = false;

	constructor(
		voiceAgentSession: VoiceAgentSession,
		fishjamAgent: FishjamAgent,
	) {
		this.voiceAgentSession = voiceAgentSession;
		this.fishjamAgent = fishjamAgent;
		this.vadStreams = new Map();
		this.activeSpeaker = null;
		this.lastOutgoingTs = null;

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

	async shutdown() {
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

		await this.voiceAgentSession.close();

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

			if (speech.start && this.activeSpeaker === null) {
				this.activeSpeaker = peerId;
				console.log(
					`[Orchestrator] Active speaker set to peer ${peerId} (speech started)`,
				);
			}

			const shouldSendAudio =
				this.activeSpeaker === peerId && !this.isInputMuted;

			if (speech.end && this.activeSpeaker === peerId) {
				console.log(
					`[Orchestrator] Active speaker ${peerId} is now silent (speech ended after ${speech.duration}ms), releasing floor`,
				);
				this.activeSpeaker = null;
			}

			if (!shouldSendAudio) {
				return;
			}

			try {
				this.voiceAgentSession.sendAudio(
					this.boostAudioVolume(vadData.audioData, 7.0),
				);
				this.lastOutgoingTs = Date.now();
			} catch (error) {
				console.error(
					`[Orchestrator] Error sending audio to AI voice agent for peer ${peerId}:`,
					error,
				);
			}
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

	private setupOutgoingAudioPipeline(): void {
		this.voiceAgentSession.registerInterruptionCallback(() => {
			console.log('[Orchestrator] Clearing audio queue due to interruption');

			this.fishjamAgent.interruptTrack(this.fishjamTrack.id);
		});

		this.voiceAgentSession.registerAgentAudioCallback((audio) => {
			console.log('[Orchestrator] Received Agent Audio, sending to Fishjam');
			this.fishjamAgent.sendData(this.fishjamTrack.id, audio);
		});
	}

	private boostAudioVolume(audioBuffer: Buffer, gain = 2.0): Buffer {
		for (let offset = 0; offset < audioBuffer.length - 1; offset += 2) {
			const sample = audioBuffer.readInt16LE(offset);
			const amplified = Math.round(sample * gain);
			const clamped = Math.max(-32768, Math.min(32767, amplified));
			audioBuffer.writeInt16LE(clamped, offset);
		}

		return audioBuffer;
	}
}
