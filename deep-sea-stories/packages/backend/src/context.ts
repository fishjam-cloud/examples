import { FishjamClient } from '@fishjam-cloud/js-server-sdk';
import type { CreateFastifyContextOptions } from '@trpc/server/adapters/fastify';
import type { CreateWSSContextFnOptions } from '@trpc/server/adapters/ws';
import { CONFIG } from './config.js';

const fishjam = new FishjamClient({
	fishjamId: CONFIG.FISHJAM_ID,
	managementToken: CONFIG.FISHJAM_MANAGEMENT_TOKEN,
});

export function createContext({ req, res }: CreateFastifyContextOptions) {
	return { req, res, fishjam };
}

export function createWSContext({ req, res }: CreateWSSContextFnOptions) {
	return { req, res, fishjam };
}

export type Context =
	| {
			req: CreateFastifyContextOptions['req'];
			res: CreateFastifyContextOptions['res'];
			fishjam: FishjamClient;
	  }
	| {
			req: CreateWSSContextFnOptions['req'];
			res: CreateWSSContextFnOptions['res'];
			fishjam: FishjamClient;
	  };
