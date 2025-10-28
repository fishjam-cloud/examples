import dotenv from 'dotenv';
import z from 'zod';
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { Story } from './types.js';
import type { PeerOptions } from '@fishjam-cloud/js-server-sdk';

dotenv.config({ quiet: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const configSchema = z.object({
	PORT: z.coerce.number().int().default(8000),
	FISHJAM_ID: z.string(),
	FISHJAM_MANAGEMENT_TOKEN: z.string(),
	ELEVENLABS_API_KEY: z.string(),
});

export const stories: Story[] = JSON.parse(
	fs.readFileSync(join(__dirname, 'prompts', 'stories.json'), 'utf8'),
);

export const CONFIG = configSchema.parse(process.env);

export const AGENT_INSTRUCTIONS_TEMPLATE = fs.readFileSync(
	join(__dirname, 'prompts', 'instructions-template.md'),
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
