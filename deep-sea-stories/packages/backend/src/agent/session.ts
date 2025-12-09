export interface VoiceAgentSession {
	sendAudio: (audio: Buffer) => void;
	registerInterruptionCallback: (onInterrupt: () => void) => void;
	registerAgentAudioCallback: (onAgentAudio: (audio: Buffer) => void) => void;
	announceTimeExpired: () => Promise<void>;
	close: (wait: boolean) => Promise<void>;
	open: () => Promise<void>;
}
