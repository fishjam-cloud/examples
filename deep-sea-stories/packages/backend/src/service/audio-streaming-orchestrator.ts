import type {
	FishjamAgent,
	PeerId,
	TrackId,
} from '@fishjam-cloud/js-server-sdk';
import type { Conversation } from '../types.js';
import VAD, { type VADData } from 'node-vad';
import { VAD_DEBOUNCE_MS } from '../config.js';

export class AudioStreamingOrchestrator {
	private static readonly OUTPUT_FRAMES_PER_BUFFER = 1000; // 62.5ms @ 16kHz
	private static readonly SAMPLE_RATE = 16000;
	private static readonly BYTES_PER_SAMPLE = 2;
	private static readonly CHANNELS = 1;

	private fishjamAgent: FishjamAgent;
	private connectedPeers: Set<PeerId>;
	private vadStreams: Map<PeerId, NodeJS.ReadWriteStream>;
	private activeSpeaker: PeerId | null;
	private sharedSession: Conversation | null;
	private audioTrackId: TrackId | null;
	private audioChunkCount: number;
	private audioQueue: Uint8Array[];
	private lastOutgoingTs: number | null;
	private silenceIntervalId: NodeJS.Timeout | null;
	private interruptionCooldownTimer: NodeJS.Timeout | null;
	private outputInterval?: NodeJS.Timeout | null;

	constructor(
		fishjamAgent: FishjamAgent,
		connectedPeers: Set<PeerId>,
		sharedSession: Conversation | null,
	) {
		this.fishjamAgent = fishjamAgent;
		this.connectedPeers = connectedPeers;
		this.vadStreams = new Map();
		this.activeSpeaker = null;
		this.sharedSession = sharedSession;
		this.audioTrackId = null;
		this.audioChunkCount = 0;
		this.audioQueue = [];
		this.lastOutgoingTs = null;
		this.silenceIntervalId = null;
		this.interruptionCooldownTimer = null;

		for (const peerId of connectedPeers) {
			this.initializeVADStream(peerId);
		}
	}

	private initializeVADStream(peerId: PeerId): void {
		const vadStream = VAD.createStream({
			mode: VAD.Mode.VERY_AGGRESSIVE,
			audioFrequency: 16000,
			debounceTime: VAD_DEBOUNCE_MS,
		});

		this.vadStreams.set(peerId, vadStream);

		vadStream.on('data', (vadData: VADData) => {
			const { speech } = vadData;

			if (speech.start && this.activeSpeaker === null) {
				this.activeSpeaker = peerId;
				console.log(
					`[Orchestrator] Active speaker set to peer ${peerId} (speech started)`,
				);
			}

			const shouldSendAudio = this.activeSpeaker === peerId;

			if (speech.end && this.activeSpeaker === peerId) {
				console.log(
					`[Orchestrator] Active speaker ${peerId} is now silent (speech ended after ${speech.duration}ms), releasing floor`,
				);
				this.activeSpeaker = null;

				try {
					if (this.sharedSession) {
						this.sharedSession.sendUserActivity();
						console.log(
							`[Orchestrator] Sent user activity to AI session for peer ${peerId}`,
						);
					}
				} catch (err) {
					console.error(
						'[Orchestrator] Failed to send user activity on speech end:',
						err,
					);
				}
			}

			if (shouldSendAudio && vadData.audioData && this.sharedSession) {
				try {
					const boostedAudio = this.boostAudioVolume(vadData.audioData, 7.0);
					console.log(
						`[Orchestrator] Sending ${boostedAudio.length} bytes of boosted audio from peer ${peerId} to AI agent`,
					);
					this.sharedSession.sendAudio(boostedAudio);
					this.lastOutgoingTs = Date.now();
				} catch (error) {
					console.error(
						`[Orchestrator] Error sending audio to AI voice agent for peer ${peerId}:`,
						error,
					);
				}
			}
		});
	}

	setupIncomingAudioPipeline(): void {
		this.fishjamAgent.on('trackData', (trackMsg) => {
			if (!this.connectedPeers.has(trackMsg.peerId)) {
				return;
			}

			if (!trackMsg.data) {
				return;
			}

			const vadStream = this.vadStreams.get(trackMsg.peerId);
			if (vadStream) {
				vadStream.write(trackMsg.data);
			}
		});
	}

	setupOutgoingAudioPipeline(): void {
		const audioTrack = this.fishjamAgent.createTrack({
			encoding: 'pcm16',
			sampleRate: AudioStreamingOrchestrator.SAMPLE_RATE,
			channels: AudioStreamingOrchestrator.CHANNELS,
		});

		this.audioTrackId = audioTrack.id as TrackId;

		if (!this.sharedSession) {
			console.warn('[Orchestrator] No shared session found for outgoing audio');
			return;
		}

		this.sharedSession.on('agentAudio', (audioEvent) => {
			try {
				this.audioChunkCount++;

				console.log(
					`[Orchestrator] Received audio chunk #${this.audioChunkCount}, event_id: ${audioEvent.event_id ?? 'none'}`,
				);

				if (this.interruptionCooldownTimer !== null) {
					console.log(
						`[Orchestrator] Discarding audio chunk #${this.audioChunkCount} due to interruption cooldown`,
					);
					return;
				}

				const audioBuffer = this.decodeAudioEvent(audioEvent);
				const chunkSize =
					AudioStreamingOrchestrator.OUTPUT_FRAMES_PER_BUFFER *
					AudioStreamingOrchestrator.BYTES_PER_SAMPLE; // pcm16 mono
				if (audioBuffer && audioBuffer.length > 0) {
					for (
						let offset = 0;
						offset < audioBuffer.length;
						offset += chunkSize
					) {
						const end = Math.min(offset + chunkSize, audioBuffer.length);
						const chunk = audioBuffer.slice(offset, end);
						this.audioQueue.push(chunk);
					}
				} else {
					console.warn(
						`[Orchestrator] Received empty audio buffer from agent (chunk #${this.audioChunkCount})`,
					);
				}
			} catch (error) {
				console.error('[Orchestrator] Error processing agent audio:', error);
			}
		});

		this.sharedSession.on('interruption', (event) => {
			console.log('[Orchestrator] Interruption event received:', event);

			if (this.interruptionCooldownTimer) {
				clearTimeout(this.interruptionCooldownTimer);
			}

			console.log('[Orchestrator] Clearing audio queue due to interruption');
			this.audioChunkCount = 0;
			this.audioQueue = [];
			this.fishjamAgent.interruptTrack(this.audioTrackId as TrackId);

			this.interruptionCooldownTimer = setTimeout(() => {
				this.interruptionCooldownTimer = null;
				console.log(
					'[Orchestrator] Interruption cooldown ended, resuming normal audio playback',
				);
			}, 500);
		});

		if (!this.silenceIntervalId) {
			this.silenceIntervalId = setInterval(() => {
				try {
					if (!this.sharedSession) return;
					const now = Date.now();
					if (
						this.activeSpeaker === null &&
						(!this.lastOutgoingTs || now - this.lastOutgoingTs > 1200)
					) {
						const silence = this.generateBackgroundNoise(1920);
						this.sharedSession.sendAudio(silence);
						this.lastOutgoingTs = now;
						console.log(
							'[Orchestrator] Sent background noise packet to AI session to keep it primed',
						);
					}
				} catch (err) {
					console.error('[Orchestrator] Failed to send silence packet:', err);
				}
			}, 1000);
		}

		if (!this.outputInterval) {
			const outputIntervalMs =
				(AudioStreamingOrchestrator.OUTPUT_FRAMES_PER_BUFFER /
					AudioStreamingOrchestrator.SAMPLE_RATE) *
				1000;

			this.outputInterval = setInterval(() => {
				if (this.interruptionCooldownTimer !== null) {
					return;
				}

				if (this.audioQueue.length > 0 && this.audioTrackId) {
					const frame = this.audioQueue.shift();
					if (frame) {
						try {
							this.fishjamAgent.sendData(this.audioTrackId, frame);
						} catch (err) {
							console.error('[Orchestrator] Error sending audio frame:', err);
						}
					}
				}
			}, outputIntervalMs);
		}
	}

	private generateBackgroundNoise(size: number): Buffer {
		const buffer = Buffer.alloc(size);
		const view = new DataView(buffer.buffer, buffer.byteOffset, size);

		for (let i = 0; i < size; i += 2) {
			const noise = Math.floor((Math.random() - 0.5) * 200);
			view.setInt16(i, noise, true); // true = little-endian
		}

		return buffer;
	}

	private boostAudioVolume(audioBuffer: Uint8Array, gain = 2.0): Uint8Array {
		const boosted = new Uint8Array(audioBuffer.length);
		const view = new DataView(audioBuffer.buffer, audioBuffer.byteOffset);
		const outView = new DataView(boosted.buffer);

		for (let i = 0; i < audioBuffer.length; i += 2) {
			const sample = view.getInt16(i, true);
			let amplified = Math.round(sample * gain);
			amplified = Math.max(-32768, Math.min(32767, amplified));
			outView.setInt16(i, amplified, true);
		}

		return boosted;
	}

	setupAudioPipelines(): void {
		this.setupIncomingAudioPipeline();
		this.setupOutgoingAudioPipeline();
	}

	shutdown(): void {
		for (const vadStream of this.vadStreams.values()) {
			vadStream.unpipe();
		}
		this.vadStreams.clear();

		if (this.silenceIntervalId) {
			clearInterval(this.silenceIntervalId);
			this.silenceIntervalId = null;
			console.log(
				'[Orchestrator] Cleared silence keep-alive interval (cleanup)',
			);
		}

		if (this.outputInterval) {
			clearInterval(this.outputInterval);
			this.outputInterval = null;
			console.log('[Orchestrator] Cleared output interval (cleanup)');
		}

		if (this.interruptionCooldownTimer) {
			clearTimeout(this.interruptionCooldownTimer);
			this.interruptionCooldownTimer = null;
		}

		if (this.fishjamAgent) {
			this.fishjamAgent.removeAllListeners('trackData');
			this.fishjamAgent.deleteTrack(this.audioTrackId as TrackId);
		}
	}

	addPeer(peerId: PeerId): void {
		if (!this.vadStreams.has(peerId)) {
			this.initializeVADStream(peerId);
			console.log(
				`[Orchestrator] Initialized VAD stream for new peer ${peerId}`,
			);
		}
	}

	removePeer(peerId: PeerId): void {
		const vadStream = this.vadStreams.get(peerId);

		if (vadStream) {
			vadStream.unpipe();
			this.vadStreams.delete(peerId);
		}

		this.connectedPeers.delete(peerId);

		if (this.activeSpeaker === peerId) {
			console.log(
				`[Orchestrator] Active speaker ${peerId} left, releasing floor`,
			);
			this.activeSpeaker = null;
		}

		if (this.connectedPeers.size === 0) {
			if (this.silenceIntervalId) {
				clearInterval(this.silenceIntervalId);
				this.silenceIntervalId = null;
			}
			if (this.outputInterval) {
				clearInterval(this.outputInterval);
				this.outputInterval = null;
			}
			console.log(
				'[Orchestrator] Cleared silence keep-alive interval (no connected peers)',
			);
		}
	}

	private decodeAudioEvent(audioEvent: {
		audio_base_64?: string;
	}): Uint8Array | null {
		if (!audioEvent.audio_base_64) {
			return null;
		}

		try {
			return Uint8Array.from(atob(audioEvent.audio_base_64), (c) =>
				c.charCodeAt(0),
			);
		} catch (error) {
			console.error('Error decoding audio event:', error);
			return null;
		}
	}
}
