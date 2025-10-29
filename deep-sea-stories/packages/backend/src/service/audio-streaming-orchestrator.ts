/**
 * AudioStreamingOrchestrator
 * Emits:
 *   - 'audioData': (audio: Buffer, peerId: PeerId) => void
 *   - 'activeSpeakerChanged': (peerId: PeerId | null) => void
 *   - 'speechEnd': (peerId: PeerId) => void
 */
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
				this.emit('activeSpeakerChanged', peerId);
			}
			const shouldSendAudio = this.activeSpeaker === peerId;
			if (speech.end && this.activeSpeaker === peerId) {
				this.activeSpeaker = null;
				this.emit('activeSpeakerChanged', null);
				this.emit('speechEnd', peerId);
			}
			if (shouldSendAudio && vadData.audioData) {
				this.emit('audioData', vadData.audioData, peerId);
			}
		});
	}

	/**
	 * Pipe incoming peer audio into VAD streams
	 */
	setupIncomingAudioPipeline(): void {
		this.fishjamAgent.on('trackData', (trackMsg) => {
			if (!this.connectedPeers.has(trackMsg.peerId)) return;
			if (!trackMsg.data) return;
			const vadStream = this.vadStreams.get(trackMsg.peerId);
			if (vadStream) vadStream.write(trackMsg.data);
		});
	}

	/**
	 * Add a peer and start VAD for their stream
	 */
	addPeer(peerId: PeerId): void {
		if (!this.vadStreams.has(peerId)) {
			this.connectedPeers.add(peerId);
			this.initializeVADStream(peerId);
			this.emit('peerAdded', peerId);
		}
	}

	/**
	 * Remove a peer and clean up their VAD stream
	 */
	removePeer(peerId: PeerId): void {
		const vadStream = this.vadStreams.get(peerId);
		if (vadStream) {
			vadStream.unpipe && vadStream.unpipe();
			this.vadStreams.delete(peerId);
		}
		this.connectedPeers.delete(peerId);
		if (this.activeSpeaker === peerId) {
			this.activeSpeaker = null;
			this.emit('activeSpeakerChanged', null);
		}
		this.emit('peerRemoved', peerId);
	}

	/**
	 * Get the current active speaker (or null)
	 */
	getActiveSpeaker(): PeerId | null {
		return this.activeSpeaker;
	}
}
