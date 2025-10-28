import {
	type FastifyTRPCPluginOptions,
	fastifyTRPCPlugin,
} from '@trpc/server/adapters/fastify';
import { applyWSSHandler } from '@trpc/server/adapters/ws';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { WebSocketServer } from 'ws';
import { CONFIG } from './config.js';
import { createContext, createWSContext } from './context.js';
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
	await fastify.listen({ port: CONFIG.PORT, host: '0.0.0.0' });

	const wss = new WebSocketServer({
		server: fastify.server,
		path: '/api/v1',
	});

	applyWSSHandler({
		wss,
		router: appRouter,
		createContext: createWSContext,
		keepAlive: {
			enabled: true,
			pingMs: 30000,
			pongWaitMs: 5000,
		},
	});

	wss.on('connection', (ws) => {
		fastify.log.info(`➕➕ WebSocket Connection (${wss.clients.size})`);
		ws.once('close', () => {
			fastify.log.info(`➖➖ WebSocket Connection (${wss.clients.size})`);
		});
	});

	fastify.log.info('WebSocket server started for tRPC subscriptions');
} catch (err) {
	fastify.log.error(err);
	process.exit(1);
}

export type { AppRouter };
