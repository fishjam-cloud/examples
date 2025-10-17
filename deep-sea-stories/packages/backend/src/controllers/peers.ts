import type { RoomId } from '@fishjam-cloud/js-server-sdk';
import { createPeerInputSchema } from '../schemas.js';
import { publicProcedure } from '../trpc.js';
import { roomService } from '../service/room.js';

export const createPeer = publicProcedure
	.input(createPeerInputSchema)
	.mutation(async ({ ctx, input }) => {
		const room = await ctx.fishjam.getRoom(input.roomId as RoomId);
		if (!room) {
			throw new Error(`Room with id ${input.roomId} does not exist`);
		}

		const gameSession = roomService.getGameSession(room.id);
		if (!gameSession) {
			throw new Error(`No game session found for room with id ${input.roomId}`);
		}

		const roomAgent = gameSession.getFishjamAgent();
		if (room.peers.length > 0 && !roomAgent) {
			throw new Error(
				`Room with id ${input.roomId} already has a peer and no agent`,
			);
		}

		if (room.peers.length === 0) {
			await gameSession.createFishjamAgent(ctx.fishjam);
		}

		const { peer, peerToken } = await gameSession.createPeer(ctx.fishjam);

		return {
			peer: peer,
			token: peerToken,
		};
	});
