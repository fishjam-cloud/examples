import type { RoomId } from '@fishjam-cloud/js-server-sdk';
import { voiceAgentMuteInputSchema } from '../schemas.js';
import { roomService } from '../service/room.js';
import { publicProcedure } from '../trpc.js';

export const muteVoiceAgent = publicProcedure
	.input(voiceAgentMuteInputSchema)
	.mutation(async ({ input }) => {
		try {
			roomService
				.getGameRoom(input.roomId as RoomId)
				?.getGameSession()
				?.setAiAgentMuted(input.muted);

			return {
				success: true,
				message: `Voice agent in room "${input.roomId}" has been ${
					input.muted ? 'muted' : 'unmuted'
				} successfully`,
			};
		} catch (error) {
			console.error(
				`Error muting/unmuting voice agent in room "${input.roomId}": `,
				error,
			);
			throw new Error((error as Error).message);
		}
	});
