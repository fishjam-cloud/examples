import type { RoomId } from '@fishjam-cloud/js-server-sdk';
import { createPeerInputSchema } from '../schemas.js';
import { publicProcedure } from '../trpc.js';
import { roomService } from '../service/room.js';
import { GameSession } from '../service/game-session.js';

export const createPeer = publicProcedure
	.input(createPeerInputSchema)
	.mutation(async ({ ctx, input }) => {
		const room = await ctx.fishjam.getRoom(input.roomId as RoomId);
		if (!room) {
			throw new Error(`Room with id ${input.roomId} does not exist`);
		}

		let gameSession = roomService.getGameSession(room.id);
		if (!gameSession) {
			gameSession = new GameSession(room.id);
			roomService.setGameSession(room.id, gameSession);
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

		const { peer, peerToken } = await gameSession.createPeer(
			ctx.fishjam,
			input.name,
		);

		return {
			peer: peer,
			token: peerToken,
		};
	});
