import type { RoomId } from '@fishjam-cloud/js-server-sdk';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import z from 'zod';
import { createRoom, getRoom } from '../controllers/rooms.js';
import { roomSchema } from '../schemas.js';

const routes: FastifyPluginAsyncZod = async (fastify) => {
	fastify.post(
		'/',
		{
			schema: {
				response: {
					201: roomSchema,
				},
			},
		},
		async () => {
			return await createRoom(fastify.fishjam);
		},
	);

	fastify.get(
		'/:roomId',
		{
			schema: {
				params: z.object({
					roomId: z.string(),
				}),
				response: {
					200: roomSchema,
				},
			},
		},
		async (req) => await getRoom(fastify.fishjam, req.params.roomId as RoomId),
	);
};

export default routes;
