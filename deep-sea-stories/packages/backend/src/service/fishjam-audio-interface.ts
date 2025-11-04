import { AudioInterface } from '@elevenlabs/elevenlabs-js/api/resources/conversationalAi/conversation/AudioInterface.js';
import { AudioStreamingOrchestrator } from './audio-streaming-orchestrator.js';
import type { FishjamAgent, TrackId } from '@fishjam-cloud/js-server-sdk';

export class FishjamAudioInterface extends AudioInterface {
	private static readonly INPUT_FRAMES_PER_BUFFER = 4000; // 250ms @ 16kHz
	private static readonly OUTPUT_FRAMES_PER_BUFFER = 1000; // 62.5ms @ 16kHz
	private static readonly SAMPLE_RATE = 16000;
	private static readonly CHANNELS = 1;

	private inputCallback?: (audio: Buffer) => void;
	private inputBuffer: Buffer = Buffer.alloc(0);
	private outputBuffer: Buffer = Buffer.alloc(0);
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
		this.inputBuffer = Buffer.alloc(0);
		this.outputBuffer = Buffer.alloc(0);

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

		this.inputBuffer = Buffer.alloc(0);
		this.outputBuffer = Buffer.alloc(0);
		this.inputCallback = undefined;
	}

	/**
	 * Output audio to the user.
	 *
	 * @param audio Audio data to output to the speaker
	 */
	public output(audio: Buffer): void {
		if (!this.shouldStop) {
			this.outputBuffer = Buffer.concat([this.outputBuffer, audio]);
		}
	}

	/**
	 * Interruption signal to stop any audio output.
	 */
	public interrupt(): void {
		// Clear the output buffer to stop any audio that is currently playing
		this.outputBuffer = Buffer.alloc(0);
	}

	/**
	 * Starts audio input processing.
	 */
	private _startAudioInput(): void {
		// Set up the audio data listener once
		this.orchestrator.on('audioData', (audioChunk: Buffer) => {
			if (!this.shouldStop) {
				this.inputBuffer = Buffer.concat([this.inputBuffer, audioChunk]);
			}
		});

		this.inputInterval = setInterval(() => {
			if (this.shouldStop || !this.inputCallback) {
				return;
			}

			const chunkSize = FishjamAudioInterface.INPUT_FRAMES_PER_BUFFER * 2;

			if (this.inputBuffer.length >= chunkSize) {
				const chunk = this.inputBuffer.subarray(0, chunkSize);
				this.inputBuffer = this.inputBuffer.subarray(chunkSize);
				this.inputCallback(chunk);
			}
		}, 250); // 250ms intervals for 4000 samples at 16kHz
	}

	/**
	 * Starts audio output processing.
	 */
	private _startAudioOutput(): void {
		const audioTrack = this.fishjamAgent.createTrack({
			encoding: 'pcm16',
			sampleRate: FishjamAudioInterface.SAMPLE_RATE,
			channels: FishjamAudioInterface.CHANNELS,
		});
		const audioTrackId = audioTrack.id as TrackId;

		this.outputInterval = setInterval(() => {
			if (this.shouldStop) {
				return;
			}

			const chunkSize = FishjamAudioInterface.OUTPUT_FRAMES_PER_BUFFER * 2;

			if (this.outputBuffer.length >= chunkSize) {
				const chunk = this.outputBuffer.subarray(0, chunkSize);
				this.outputBuffer = this.outputBuffer.subarray(chunkSize);
				console.debug(`Playing audio chunk of ${chunk.length} bytes`);
				this.fishjamAgent.sendData(audioTrackId, chunk);
			}
		}, 62.5); // ~62.5ms intervals for 1000 samples at 16kHz
	}
}
