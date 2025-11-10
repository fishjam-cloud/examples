import type {
	FishjamAgent,
	PeerId,
	TrackId,
} from '@fishjam-cloud/js-server-sdk';
import type { Conversation } from '../types.js';
import VAD, { type VADData } from 'node-vad';
import { VAD_DEBOUNCE_MS } from '../config.js';

export class AudioStreamingOrchestrator {
	private fishjamAgent: FishjamAgent;
	private connectedPeers: Set<PeerId>;
	private vadStreams: Map<PeerId, NodeJS.ReadWriteStream>;
	private activeSpeaker: PeerId | null;
	private sharedSession: Conversation | null;
	private audioTrackId: TrackId | null;
	private audioChunkCount: number;
	private isSendingAudio: boolean;
	private audioQueue: Uint8Array[];
	private lastOutgoingTs: number | null;
	private silenceIntervalId: NodeJS.Timeout | null;
	private pendingInterruption: boolean;
	private pendingInterruptionTimer: NodeJS.Timeout | null;
	private isInputMuted: boolean = false;

	setMuted(muted: boolean): void {
		this.isInputMuted = muted;
		console.log(`[Orchestrator] User audio input to AI is now ${muted ? 'blocked' : 'enabled'}`);
	}

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
		this.isSendingAudio = false;
		this.audioQueue = [];
		this.lastOutgoingTs = null;
		this.silenceIntervalId = null;
		this.pendingInterruption = false;
		this.pendingInterruptionTimer = null;

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

			if (shouldSendAudio && vadData.audioData && this.sharedSession && !this.isInputMuted) {
				try {
					if (this.pendingInterruption) {
						this.pendingInterruption = false;
						if (this.pendingInterruptionTimer) {
							clearTimeout(this.pendingInterruptionTimer);
							this.pendingInterruptionTimer = null;
						}
					}

					try {
						const boostedAudio = this.boostAudioVolume(vadData.audioData, 7.0);
						console.log(
							`[Orchestrator] Sending ${boostedAudio.length} bytes of boosted audio from peer ${peerId} to AI agent`,
						);
						this.sharedSession.sendAudio(boostedAudio);
						this.lastOutgoingTs = Date.now();
					} catch (error) {
						console.error(
							` [Orchestrator] Error sending audio to AI voice agent for peer ${peerId}:`,
							error,
						);
					}
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
			sampleRate: 16000,
			channels: 1,
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

				const audioBuffer = this.decodeAudioEvent(audioEvent);
				if (audioBuffer && audioBuffer.length > 0) {
					this.audioQueue.push(audioBuffer);
					this.processAudioQueue();
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
			if (this.pendingInterruptionTimer) {
				clearTimeout(this.pendingInterruptionTimer);
				this.pendingInterruptionTimer = null;
			}
			this.pendingInterruption = true;
			this.pendingInterruptionTimer = setTimeout(() => {
				if (!this.pendingInterruption) return;
				console.log(
					'[Orchestrator] Clearing audio queue after confirmed interruption',
				);
				this.audioChunkCount = 0;
				this.audioQueue = [];
				this.isSendingAudio = false;
				this.pendingInterruption = false;
				this.pendingInterruptionTimer = null;
			}, 150);
		});

		this.silenceIntervalId = setInterval(() => {
			try {
				if (!this.sharedSession) return;
				const now = Date.now();
				if (
					this.activeSpeaker === null &&
					(!this.lastOutgoingTs || now - this.lastOutgoingTs > 1200)
				) {
					// Generate realistic background noise instead of pure silence
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

	private async processAudioQueue(): Promise<void> {
		if (this.isSendingAudio) {
			return;
		}

		this.isSendingAudio = true;

		try {
			// We'll stream each agent audio buffer in smaller frames and pace them
			// according to real-time playback duration. This prevents sending very
			// large blobs at once which can cause clients to play only the first
			// part and drop the rest.
			const BYTES_PER_SECOND = 16000 * 2; // pcm16 mono: 16k samples/sec * 2 bytes/sample
			const FRAME_SIZE = 1920; // bytes per frame (~60ms at 16kHz pcm16)
			while (this.audioQueue.length > 0) {
				const audioBuffer = this.audioQueue.shift();
				if (audioBuffer && this.audioTrackId) {
					console.log(
						`[Orchestrator] Sending audio chunk (${audioBuffer.length} bytes), ${this.audioQueue.length} remaining in queue`,
					);
					try {
						for (
							let offset = 0;
							offset < audioBuffer.length;
							offset += FRAME_SIZE
						) {
							const end = Math.min(offset + FRAME_SIZE, audioBuffer.length);
							const frame = audioBuffer.slice(offset, end);
							try {
								this.fishjamAgent.sendData(this.audioTrackId, frame);
							} catch (err) {
								console.error('[Orchestrator] Error sending audio frame:', err);
							}
							// Pace frames by their real-time duration. Minimum 10ms to avoid
							// extremely small waits that would busy-loop.
							const frameDurationMs = Math.max(
								10,
								Math.round((frame.length / BYTES_PER_SECOND) * 1000),
							);
							await new Promise((resolve) =>
								setTimeout(resolve, frameDurationMs),
							);
						}
					} catch (error) {
						console.error(
							'[Orchestrator] Error processing audio chunk frames:',
							error,
						);
					}
				}
			}
		} finally {
			this.isSendingAudio = false;
		}
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

		if (this.connectedPeers.size === 0 && this.silenceIntervalId) {
			clearInterval(this.silenceIntervalId);
			this.silenceIntervalId = null;
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
