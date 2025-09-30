import dotenv from 'dotenv';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import z from 'zod';

dotenv.config();

declare module 'fastify' {
	interface FastifyInstance {
		config: ConfigSchema;
	}
}

export const configSchema = z.object({
	PORT: z.coerce.number().int().default(8000),
	FISHJAM_ID: z.string(),
	FISHJAM_URL: z.string().optional(),
	FISHJAM_MANAGEMENT_TOKEN: z.string(),
});

type ConfigSchema = z.infer<typeof configSchema>;

export const fastifyConfig = fp((fastify: FastifyInstance) => {
	fastify.decorate('config', configSchema.parse(process.env));
});
