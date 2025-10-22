import {
	type FastifyTRPCPluginOptions,
	fastifyTRPCPlugin,
} from '@trpc/server/adapters/fastify';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { CONFIG } from './config.js';
import { createContext } from './context.js';
import { type AppRouter, appRouter } from './router.js';
import { notifierService } from './service/notifier.js';

const fastify = Fastify({
	logger: { transport: { target: 'pino-pretty' } },
});

await fastify.register(cors, {
	origin: true,
	credentials: true,
});

fastify.register(fastifyTRPCPlugin, {
	prefix: '/api/v1',
	trpcOptions: {
		router: appRouter,
		createContext,
		onError({ path, error }) {
			fastify.log.error('Error in tRPC handler on path %s: %O', path, error);
		},
	} satisfies FastifyTRPCPluginOptions<AppRouter>['trpcOptions'],
});

try {
	await notifierService.initialize();

	await fastify.ready();
	await fastify.listen({ port: CONFIG.PORT });
} catch (err) {
	fastify.log.error(err);
	process.exit(1);
}

export type { AppRouter };
