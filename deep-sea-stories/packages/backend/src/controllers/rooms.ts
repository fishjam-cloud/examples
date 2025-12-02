import { publicProcedure } from '../trpc.js';

export const createRoom = publicProcedure.mutation(async ({ ctx }) => {
	const room = await ctx.fishjam.createRoom();
	return room;
});
