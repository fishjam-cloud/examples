import type {
	FishjamAgent,
	PeerId,
	TrackId,
} from '@fishjam-cloud/js-server-sdk';
import type { Conversation } from '../types.js';
import VAD, { type VADData } from 'node-vad';
import { PassThrough } from 'node:stream';
import { VAD_DEBOUNCE_MS } from '../config.js';

export class AudioStreamingOrchestrator {
	private fishjamAgent: FishjamAgent;
	private connectedPeers: Set<PeerId>;
	private peerStreams: Map<PeerId, PassThrough>;
	private vadStreams: Map<PeerId, NodeJS.ReadWriteStream>;
	private peerAudioBaseTs: Map<PeerId, number>;
	private peerAudioSentMs: Map<PeerId, number>;
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

	constructor(
		fishjamAgent: FishjamAgent,
		connectedPeers: Set<PeerId>,
		sharedSession: Conversation | null,
	) {
		this.fishjamAgent = fishjamAgent;
		this.connectedPeers = connectedPeers;
		this.peerStreams = new Map();
		this.vadStreams = new Map();
		this.peerAudioBaseTs = new Map();
		this.peerAudioSentMs = new Map();
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
		const audioStream = new PassThrough();
		this.peerStreams.set(peerId, audioStream);

		const vadStream = VAD.createStream({
			mode: VAD.Mode.VERY_AGGRESSIVE,
			audioFrequency: 16000,
			debounceTime: VAD_DEBOUNCE_MS,
		});

		this.vadStreams.set(peerId, vadStream);

		audioStream.pipe(vadStream).on('data', (vadData: VADData) => {
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
						if (typeof (this.sharedSession as any).sendUserActivity === 'function') {
							(this.sharedSession as any).sendUserActivity();
							console.log(`[Orchestrator] Sent user activity to AI session for peer ${peerId}`);
						}
					}
				} catch (err) {
					console.error('[Orchestrator] Failed to send user activity on speech end:', err);
				}
			}

			if (
				shouldSendAudio &&
				vadData.audioData &&
				this.sharedSession
			) {
				try {
					if (this.pendingInterruption) {
						this.pendingInterruption = false;
						if (this.pendingInterruptionTimer) {
							clearTimeout(this.pendingInterruptionTimer);
							this.pendingInterruptionTimer = null;
						}
					}
					const BYTES_PER_SECOND = 16000 * 2; // pcm16 mono
					const chunkDurationMs = Math.round((vadData.audioData.length / BYTES_PER_SECOND) * 1000);
					let baseTs = this.peerAudioBaseTs.get(peerId) ?? null;
					let sentMs = this.peerAudioSentMs.get(peerId) ?? 0;
					if (vadData.speech && vadData.speech.start) {
						baseTs = Date.now();
						sentMs = 0;
						this.peerAudioBaseTs.set(peerId, baseTs);
						this.peerAudioSentMs.set(peerId, sentMs);
					}

					const clientTs = (baseTs ?? Date.now()) + sentMs;
					try {
						console.log(
							`[Orchestrator] Sending ${vadData.audioData.length} bytes of audio from peer ${peerId} to AI agent (client_ts_ms: ${clientTs})`,
						);
						this.sharedSession.sendAudio(vadData.audioData, { clientTsMs: clientTs });
						this.lastOutgoingTs = Date.now();
						sentMs += chunkDurationMs;
						this.peerAudioSentMs.set(peerId, sentMs);
					} catch (error) {
						console.error(
							`[Orchestrator] Error sending audio to AI voice agent for peer ${peerId}:`,
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

			const peerStream = this.peerStreams.get(trackMsg.peerId);
			if (peerStream) {
				peerStream.write(trackMsg.data);
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

		this.sharedSession.on('agentAudio', (audioEvent: any) => {
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

		this.sharedSession.on('interruption', (event: any) => {
			console.log('[Orchestrator] Interruption event received:', event);
			if (this.pendingInterruptionTimer) {
				clearTimeout(this.pendingInterruptionTimer);
				this.pendingInterruptionTimer = null;
			}
			this.pendingInterruption = true;
			this.pendingInterruptionTimer = setTimeout(() => {
				if (!this.pendingInterruption) return;
				console.log('[Orchestrator] Clearing audio queue after confirmed interruption');
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
					const silence = Buffer.alloc(1920); // 1920 bytes ~ short frame at 16kHz
					(this.sharedSession as any).sendAudio(silence, { keepAlive: true });
					this.lastOutgoingTs = now;
					console.log('[Orchestrator] Sent silence packet to AI session to keep it primed');
				}
			} catch (err) {
				console.error('[Orchestrator] Failed to send silence packet:', err);
			}
		}, 1000);
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
						for (let offset = 0; offset < audioBuffer.length; offset += FRAME_SIZE) {
							const end = Math.min(offset + FRAME_SIZE, audioBuffer.length);
							const frame = audioBuffer.slice(offset, end);
							try {
								this.fishjamAgent.sendData(this.audioTrackId, frame);
							} catch (err) {
								console.error('[Orchestrator] Error sending audio frame:', err);
							}
							// Pace frames by their real-time duration. Minimum 10ms to avoid
							// extremely small waits that would busy-loop.
							const frameDurationMs = Math.max(10, Math.round((frame.length / BYTES_PER_SECOND) * 1000));
							await new Promise(resolve => setTimeout(resolve, frameDurationMs));
						}
					} catch (error) {
						console.error('[Orchestrator] Error processing audio chunk frames:', error);
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

	addPeer(peerId: PeerId): void {
		if (!this.peerStreams.has(peerId)) {
			this.connectedPeers.add(peerId);
			this.initializeVADStream(peerId);
			console.log(
				`[Orchestrator] Initialized VAD stream for new peer ${peerId}`,
			);
		}
	}

	removePeer(peerId: PeerId): void {
		const peerStream = this.peerStreams.get(peerId);
		const vadStream = this.vadStreams.get(peerId);

		if (peerStream) {
			peerStream.unpipe();
			peerStream.destroy();
			this.peerStreams.delete(peerId);
		}

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
			console.log('[Orchestrator] Cleared silence keep-alive interval (no connected peers)');
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
