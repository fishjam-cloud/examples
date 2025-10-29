import { AudioInterface } from '@elevenlabs/elevenlabs-js/api/resources/conversationalAi/conversation/AudioInterface.js';
import { AudioStreamingOrchestrator } from './audio-streaming-orchestrator.js';
import type { FishjamAgent, TrackId } from '@fishjam-cloud/js-server-sdk';

export class FishjamAudioInterface extends AudioInterface {
	private static readonly INPUT_FRAMES_PER_BUFFER = 4000; // 250ms @ 16kHz
	private static readonly OUTPUT_FRAMES_PER_BUFFER = 1000; // 62.5ms @ 16kHz
	private static readonly SAMPLE_RATE = 16000;
	private static readonly CHANNELS = 1;

	private inputCallback?: (audio: Buffer) => void;
	private outputQueue: Buffer[] = [];
	private shouldStop = false;
	private inputInterval?: NodeJS.Timeout;
	private outputInterval?: NodeJS.Timeout;

	private orchestrator: AudioStreamingOrchestrator;
	private fishjamAgent: FishjamAgent;

	constructor(
		fishjamAgent: FishjamAgent,
		orchestrator: AudioStreamingOrchestrator,
	) {
		super();
		this.fishjamAgent = fishjamAgent;
		this.orchestrator = orchestrator;
	}

	/**
	 * Starts the audio interface.
	 *
	 * @param inputCallback Function to call with audio chunks from the microphone
	 */
	public start(inputCallback: (audio: Buffer) => void): void {
		this.inputCallback = inputCallback;
		this.shouldStop = false;
		this.outputQueue = [];

		this._startAudioInput();

		this._startAudioOutput();
	}

	/**
	 * Stops the audio interface and cleans up resources.
	 */
	public stop(): void {
		this.shouldStop = true;

		if (this.inputInterval) {
			clearInterval(this.inputInterval);
			this.inputInterval = undefined;
		}

		if (this.outputInterval) {
			clearInterval(this.outputInterval);
			this.outputInterval = undefined;
		}

		this.outputQueue = [];
		this.inputCallback = undefined;
	}

	/**
	 * Output audio to the user.
	 *
	 * @param audio Audio data to output to the speaker
	 */
	public output(audio: Buffer): void {
		if (!this.shouldStop) {
			this.outputQueue.push(audio);
		}
	}

	/**
	 * Interruption signal to stop any audio output.
	 */
	public interrupt(): void {
		// Clear the output queue to stop any audio that is currently playing
		this.outputQueue.length = 0;
	}

	/**
	 * Starts audio input processing.
	 *
	 * Note: This is a placeholder implementation. In a real scenario, you would
	 * use libraries like 'mic', 'naudiodon', or 'node-record-lpcm16' to capture
	 * actual microphone input.
	 */
	private _startAudioInput(): void {
		const chunkSize = FishjamAudioInterface.INPUT_FRAMES_PER_BUFFER * 2; // 16-bit = 2 bytes per sample

		this.inputInterval = setInterval(() => {
			if (this.shouldStop || !this.inputCallback) {
				return;
			}

			this.orchestrator.on('audioData', (audioChunk: Buffer) => {
				this.inputCallback!(audioChunk);
			});
		}, 250); // 250ms intervals for 4000 samples at 16kHz
	}

	/**
	 * Starts audio output processing.
	 *
	 * Note: This is a placeholder implementation. In a real scenario, you would
	 * use libraries like 'speaker', 'naudiodon', or similar to play audio
	 * through the system speakers.
	 */
	private _startAudioOutput(): void {
		const audioTrack = this.fishjamAgent.createTrack({
			encoding: 'pcm16',
			sampleRate: 16000,
			channels: 1,
		});
		const audioTrackId = audioTrack.id as TrackId;

		this.outputInterval = setInterval(() => {
			if (this.shouldStop) {
				return;
			}

			// Process queued audio for output
			if (this.outputQueue.length > 0) {
				const audioChunk = this.outputQueue.shift();
				if (audioChunk) {
					// In a real implementation, this would play the audio
					// For now, we just log that audio would be played
					console.debug(`Playing audio chunk of ${audioChunk.length} bytes`);
					this.fishjamAgent.sendData(audioTrackId, audioChunk);
					// Here data will be passed to fishjam agent audio track
				}
			}
		}, 62.5); // ~62.5ms intervals for 1000 samples at 16kHz
	}
}
