import * as fs from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PeerOptions } from '@fishjam-cloud/js-server-sdk';
import dotenv from 'dotenv';
import z from 'zod';
import type { Story } from './types.js';

dotenv.config({ quiet: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const configSchema = z.object({
	PORT: z.coerce.number().int().default(8000),
	FISHJAM_ID: z.string(),
	FISHJAM_MANAGEMENT_TOKEN: z.string(),
	ELEVENLABS_API_KEY: z.string(),
	GEMINI_API_KEY: z.string().optional(),
	GOOGLE_GENAI_USE_VERTEXAI: z
		.string()
		.transform((val) => val.toLowerCase() === 'true')
		.default(false),
	GOOGLE_CLOUD_PROJECT: z.string().optional(),
	GOOGLE_CLOUD_LOCATION: z.string().optional(),
});

// WARNING: gemini-live-2.5-flash-preview will stop working on Dec 9!!
// https://ai.google.dev/gemini-api/docs/models#gemini-2.5-flash
// However, changing this to gemini-2.5-flash-native-audio-preview-09-2025
// somehow breaks the greeting (WTF)
export const GEMINI_MODEL = 'gemini-2.5-flash-native-audio-preview-09-2025';
// export const GEMINI_MODEL = 'gemini-live-2.5-flash-preview-native-audio';

export const stories: Story[] = JSON.parse(
	fs.readFileSync(join(__dirname, 'prompts', 'stories.json'), 'utf8'),
);

export const CONFIG = configSchema.parse(process.env);

export const AGENT_INSTRUCTIONS_TEMPLATE = fs.readFileSync(
	join(__dirname, 'prompts', 'instructions-template.md'),
	'utf8',
);

export const FIRST_MESSAGE_TEMPLATE = fs.readFileSync(
	join(__dirname, 'prompts', 'first-message-template.md'),
	'utf8',
);

export const AGENT_CLIENT_TOOL_INSTRUCTIONS = fs.readFileSync(
	join(__dirname, 'prompts', 'client-tool-instructions.md'),
	'utf8',
);

export const FISHJAM_AGENT_OPTIONS: PeerOptions = {
	output: {
		audioSampleRate: 16_000,
	},
};

export const VAD_DEBOUNCE_MS = 600;

export const AUDIO_QUEUE_INITIAL_DELAY_MS = 10000;
