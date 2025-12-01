export interface VoiceAgentSession {
	sendAudio: (audio: Buffer) => void;
	registerInterruptionCallback: (onInterrupt: () => void) => void;
	registerAgentAudioCallback: (onAgentAudio: (audio: Buffer) => void) => void;
	close: () => Promise<void>;
	open: () => Promise<void>;
}
