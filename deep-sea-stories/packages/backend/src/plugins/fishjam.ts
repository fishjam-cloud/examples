import {
	FishjamBaseException,
	FishjamClient,
} from '@fishjam-cloud/js-server-sdk';
import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';

declare module 'fastify' {
	interface FastifyInstance {
		fishjam: FishjamClient;
	}
}

export const fishjamPlugin = fp(async (fastify: FastifyInstance) => {
	const fishjamClient = new FishjamClient({
		fishjamId: fastify.config.FISHJAM_ID,
		fishjamUrl: fastify.config.FISHJAM_URL,
		managementToken: fastify.config.FISHJAM_MANAGEMENT_TOKEN,
	});

	try {
		await fishjamClient.getAllRooms();
	} catch (e) {
		if (e instanceof FishjamBaseException)
			throw Error('Invalid Fishjam configuration provided.');
	}

	fastify.decorate('fishjam', fishjamClient);
});
