import type { FishjamAgent, PeerId } from '@fishjam-cloud/js-server-sdk';
import VAD, { type VADData } from 'node-vad';
import { EventEmitter } from 'node:events';
import { VAD_DEBOUNCE_MS } from '../config.js';

export class AudioStreamingOrchestrator extends EventEmitter {
	private fishjamAgent: FishjamAgent;
	private connectedPeers: Set<PeerId>;
	private vadStreams: Map<PeerId, NodeJS.ReadWriteStream>;
	private activeSpeaker: PeerId | null;

	constructor(fishjamAgent: FishjamAgent, connectedPeers: Set<PeerId>) {
		super();
		this.fishjamAgent = fishjamAgent;
		this.connectedPeers = connectedPeers;
		this.vadStreams = new Map();
		this.activeSpeaker = null;

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
				this.emit('activeSpeakerChanged', peerId);
			}

			const shouldSendAudio = this.activeSpeaker === peerId;

			if (speech.end && this.activeSpeaker === peerId) {
				console.log(
					`[Orchestrator] Active speaker ${peerId} is now silent (speech ended after ${speech.duration}ms), releasing floor`,
				);
				this.activeSpeaker = null;
				this.emit('activeSpeakerChanged', null);
				this.emit('speechEnd', peerId);
			}

			if (shouldSendAudio && vadData.audioData) {
				console.log(
					`[Orchestrator] Outputting ${vadData.audioData.length} bytes of audio from peer ${peerId}`,
				);
				this.emit('audioData', vadData.audioData, peerId);
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

	addPeer(peerId: PeerId): void {
		if (!this.vadStreams.has(peerId)) {
			this.connectedPeers.add(peerId);
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
			this.emit('activeSpeakerChanged', null);
		}
	}

	getActiveSpeaker(): PeerId | null {
		return this.activeSpeaker;
	}
}
