import { publicProcedure } from '../trpc.js';
import { voiceAgentMuteInputSchema } from '../schemas.js';
import type { RoomId } from '@fishjam-cloud/js-server-sdk';
import { roomService } from '../service/room.js';

export const muteVoiceAgent = publicProcedure
	.input(voiceAgentMuteInputSchema)
	.mutation(async ({ input }) => {
		try {
			const gameSession = roomService.getGameSession(input.roomId as RoomId);
			gameSession?.setAiAgentMuted(input.muted);

			return {
				success: true,
				message: `Voice agent in room "${input.roomId}" has been ${
                    input.muted ? 'muted' : 'unmuted'
                } successfully`,
			};
		} catch (error) {
			console.error(`Failed to select story: %o`, error);
			throw new Error((error as Error).message);
		}
	});