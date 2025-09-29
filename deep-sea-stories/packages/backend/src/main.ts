import Fastify, {
	type FastifyInstance,
	type RouteShorthandOptions,
} from 'fastify';

const server: FastifyInstance = Fastify({
	logger: { transport: { target: 'pino-pretty' } },
});
const port = 3000;

const opts: RouteShorthandOptions = {
	schema: {
		response: {
			200: {
				type: 'object',
				properties: {
					pong: {
						type: 'string',
					},
				},
			},
		},
	},
};

server.get('/ping', opts, async (_request, _reply) => {
	return { pong: 'it worked!' };
});

try {
	await server.listen({ port });
} catch (err) {
	server.log.error(err);
	process.exit(1);
}
