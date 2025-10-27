import { FishjamClient } from '@fishjam-cloud/js-server-sdk';
import type { CreateFastifyContextOptions } from '@trpc/server/adapters/fastify';
import { CONFIG } from './config.js';

const fishjam = new FishjamClient({
	fishjamId: CONFIG.FISHJAM_ID,
	managementToken: CONFIG.FISHJAM_MANAGEMENT_TOKEN,
});

export function createContext({ req, res }: CreateFastifyContextOptions) {
	return { req, res, fishjam };
}

export function createWSContext() {
	return { req: null as any, res: null as any, fishjam };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
