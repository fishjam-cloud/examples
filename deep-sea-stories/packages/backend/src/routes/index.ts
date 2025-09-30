import type { FastifyInstance } from 'fastify';
import rooms from './rooms.js';

export default function routes(fastify: FastifyInstance) {
	fastify.register(rooms, { prefix: '/rooms' });
}
