declare module 'node-vad' {
	import { Transform } from 'node:stream';

	export interface VADData {
		time: number;
		audioData: Buffer;
		speech: {
			state: number;
			start?: boolean;
			end?: boolean;
			startTime?: number;
			duration?: number;
		};
	}

	// The runtime is a CommonJS constructor function with static properties Event/Mode
	class VAD {
		constructor(mode: number);
		processAudio(
			buffer: Buffer,
			rate: 8000 | 16000 | 32000 | 48000,
		): Promise<number>;
		processAudioFloat(
			buffer: Buffer,
			rate: 8000 | 16000 | 32000 | 48000,
		): Promise<number>;
		static createStream(opts?: {
			mode?: number;
			audioFrequency?: 8000 | 16000 | 32000 | 48000;
			debounceTime?: number;
		}): Transform;
		static toFloatBuffer(buffer: Buffer): Buffer;

		static readonly Event: {
			readonly ERROR: -1;
			readonly SILENCE: 0;
			readonly VOICE: 1;
			readonly NOISE: 2;
		};

		static readonly Mode: {
			readonly NORMAL: 0;
			readonly LOW_BITRATE: 1;
			readonly AGGRESSIVE: 2;
			readonly VERY_AGGRESSIVE: 3;
		};
	}

	export default VAD;
}
