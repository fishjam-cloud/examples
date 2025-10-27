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
	private activeSpeaker: PeerId | null;
	private sharedSession: Conversation | null;

	constructor(
		fishjamAgent: FishjamAgent,
		connectedPeers: Set<PeerId>,
		sharedSession: Conversation | null,
	) {
		this.fishjamAgent = fishjamAgent;
		this.connectedPeers = connectedPeers;
		this.peerStreams = new Map();
		this.vadStreams = new Map();
		this.activeSpeaker = null;
		this.sharedSession = sharedSession;

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

			if (speech.end && this.activeSpeaker === peerId) {
				console.log(
					`[Orchestrator] Active speaker ${peerId} is now silent (speech ended after ${speech.duration}ms), releasing floor`,
				);
				this.activeSpeaker = null;
			}

			if (
				this.activeSpeaker === peerId &&
				speech.state &&
				vadData.audioData &&
				this.sharedSession
			) {
				try {
					this.sharedSession.sendAudio(vadData.audioData);
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

		if (!this.sharedSession) {
			console.warn('[Orchestrator] No shared session found for outgoing audio');
			return;
		}

		this.sharedSession.on('agentAudio', (audioEvent) => {
			try {
				const audioBuffer = this.decodeAudioEvent(audioEvent);
				if (audioBuffer && audioBuffer.length > 0) {
					this.fishjamAgent.sendData(audioTrack.id as TrackId, audioBuffer);
				} else {
					console.error('Received empty audio buffer from AI voice agent');
				}
			} catch (error) {
				console.error('Error sending agent audio track to room:', error);
			}
		});
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
