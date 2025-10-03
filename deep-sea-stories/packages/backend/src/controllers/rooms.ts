import type { RoomId } from '@fishjam-cloud/js-server-sdk';
import { getRoomInputSchema } from '../schemas.js';
import { publicProcedure } from '../trpc.js';
import { roomService } from '../service/room.js';

export const createRoom = publicProcedure.mutation(async ({ ctx }) => {
	const room = await ctx.fishjam.createRoom();
	roomService.createStory(room.id);
	return room;
});

export const getRoom = publicProcedure
	.input(getRoomInputSchema)
	.query(async ({ ctx, input }) => {
		return await ctx.fishjam.getRoom(input.roomId as RoomId);
	});
