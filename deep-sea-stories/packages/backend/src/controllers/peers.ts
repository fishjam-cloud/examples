import {
	RoomNotFoundException,
	type RoomId,
} from '@fishjam-cloud/js-server-sdk';
import { TRPCError } from '@trpc/server';
import { GameRoomFullError } from '../domain/errors.js';
import { GameRoom } from '../game/room.js';
import { createPeerInputSchema } from '../schemas.js';
import { roomService } from '../service/room.js';
import { publicProcedure } from '../trpc.js';

export const createPeer = publicProcedure
	.input(createPeerInputSchema)
	.mutation(async ({ ctx, input }) => {
		try {
			const room = await ctx.fishjam.getRoom(input.roomId as RoomId);

			let gameRoom = roomService.getGameRoom(room.id);
			if (!gameRoom) {
				gameRoom = new GameRoom(ctx.fishjam, ctx.notifierService, room.id);
				roomService.setGameRoom(room.id, gameRoom);
			}

			const { peer, peerToken } = await gameRoom.addPlayer(input.name);
			return {
				peer,
				token: peerToken,
			};
		} catch (e) {
			if (e instanceof RoomNotFoundException) {
				console.warn(`Room ${input.roomId} not found`);
				throw new TRPCError({
					code: 'NOT_FOUND',
					message: `Room does not exist`,
				});
			}
			if (e instanceof GameRoomFullError) {
				throw new TRPCError({
					code: 'CONFLICT',
					message: e.message,
				});
			}
			throw e;
		}
	});
