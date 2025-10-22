import type {
	FishjamAgent,
	PeerId,
	TrackId,
} from '@fishjam-cloud/js-server-sdk';
import type { VoiceAgentSessionManager } from '../types.js';

export class AudioStreamingOrchestrator {
	private fishjamAgent: FishjamAgent;
	private sessionManager: VoiceAgentSessionManager;
	private connectedPeers: Set<PeerId>;

	constructor(
		fishjamAgent: FishjamAgent,
		sessionManager: VoiceAgentSessionManager,
		connectedPeers: Set<PeerId>,
	) {
		this.fishjamAgent = fishjamAgent;
		this.sessionManager = sessionManager;
		this.connectedPeers = connectedPeers;
	}

	setupIncomingAudioPipeline(): void {
		this.fishjamAgent.on('trackData', (trackMsg) => {
			if (!this.connectedPeers.has(trackMsg.peerId)) {
				return;
			}

			const session = this.sessionManager.getSession(trackMsg.peerId);
			if (session && trackMsg.data) {
				try {
					const audioBuffer = Buffer.from(trackMsg.data);
					session.sendAudio(audioBuffer);
				} catch (error) {
					console.error(
						`Error sending audio to AI voice agent for peer ${trackMsg.peerId}:`,
						error,
					);
				}
			}
		});
	}

	setupOutgoingAudioPipeline(): void {
		const audioTrack = this.fishjamAgent.createTrack({
			encoding: 'pcm16',
			sampleRate: 16000,
			channels: 1,
		});

		for (const peerId of this.connectedPeers) {
			const session = this.sessionManager.getSession(peerId);
			if (!session) {
				console.warn(`No session found for peer ${peerId}`);
				continue;
			}

			session.on('agentAudio', (audioEvent) => {
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
	}

	setupAudioPipelines(): void {
		this.setupIncomingAudioPipeline();
		this.setupOutgoingAudioPipeline();
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
