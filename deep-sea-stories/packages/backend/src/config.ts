import dotenv from 'dotenv';
import z from 'zod';
import * as fs from 'fs';

dotenv.config();

export const configSchema = z.object({
	PORT: z.coerce.number().int().default(8000),
	FISHJAM_ID: z.string(),
	FISHJAM_URL: z.string().optional(),
	FISHJAM_MANAGEMENT_TOKEN: z.string(),
});

export const CONFIG = configSchema.parse(process.env);

export const AGENT_INSTRUCTIONS = fs.readFileSync(
	'./prompts/instructions.md',
	'utf8',
);
