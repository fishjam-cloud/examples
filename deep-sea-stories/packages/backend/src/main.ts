import Fastify from 'fastify';
import {
	serializerCompiler,
	validatorCompiler,
	type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { fastifyConfig } from './config.js';
import { fishjamPlugin } from './plugins/fishjam.js';
import routes from './routes/index.js';

const fastify = Fastify({
	logger: { transport: { target: 'pino-pretty' } },
}).withTypeProvider<ZodTypeProvider>();

fastify.setValidatorCompiler(validatorCompiler);
fastify.setSerializerCompiler(serializerCompiler);

fastify.register(fastifyConfig);
fastify.register(fishjamPlugin);

fastify.register(routes, { prefix: '/api/v1' });

try {
	await fastify.ready();
	await fastify.listen({ port: fastify.config.PORT });
} catch (err) {
	fastify.log.error(err);
	process.exit(1);
}
