import type { RoomId } from '@fishjam-cloud/js-server-sdk';
import { createPeerInputSchema } from '../schemas.js';
import { publicProcedure } from '../trpc.js';
import { roomService } from '../service/room.js';

export const createPeer = publicProcedure
	.input(createPeerInputSchema)
	.mutation(async ({ ctx, input }) => {
		const room = await ctx.fishjam.getRoom(input.roomId as RoomId);
		// TODO: if doesn't exist create
		if (room.peers.length === 0) {
			await roomService.createFishjamAgent(room.id, ctx.fishjam);
		}
		const { peer, peerToken } = await roomService.createPeer(
			room.id,
			ctx.fishjam,
		);

		return {
			peer: peer,
			token: peerToken,
		};
	});
