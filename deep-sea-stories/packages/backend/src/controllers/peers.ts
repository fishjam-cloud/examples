import type { RoomId } from '@fishjam-cloud/js-server-sdk';
import { TRPCError } from '@trpc/server';
import { GameRoomFullError } from '../domain/errors.js';
import { GameRoom } from '../game/room.js';
import { createPeerInputSchema } from '../schemas.js';
import { roomService } from '../service/room.js';
import { publicProcedure } from '../trpc.js';

export const createPeer = publicProcedure
	.input(createPeerInputSchema)
	.mutation(async ({ ctx, input }) => {
		const room = await ctx.fishjam.getRoom(input.roomId as RoomId);
		if (!room) {
			throw new Error(`Room with id ${input.roomId} does not exist`);
		}

		let gameRoom = roomService.getGameRoom(room.id);
		if (!gameRoom) {
			gameRoom = new GameRoom(ctx.fishjam, ctx.notifierService, room.id);
			roomService.setGameRoom(room.id, gameRoom);
		}

		try {
			const { peer, peerToken } = await gameRoom.addPlayer(input.name);
			return {
				peer,
				token: peerToken,
			};
		} catch (error) {
			if (error instanceof GameRoomFullError) {
				throw new TRPCError({
					code: 'BAD_REQUEST',
					message: error.message,
				});
			}
			throw error;
		}
	});
