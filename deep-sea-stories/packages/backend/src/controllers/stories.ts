import { publicProcedure } from '../trpc.js';
import { stories } from '../config.js';
import { startStoryInputSchema } from '../schemas.js';
import type { RoomId } from '@fishjam-cloud/js-server-sdk';
import { roomService } from '../service/room.js';
import { FailedToStartStoryError } from '../domain/errors.js';

export const startStory = publicProcedure
	.input(startStoryInputSchema)
	.mutation(async ({ input }) => {
		const selectedStory = stories.find((s) => s.id === input.storyId);
		if (!selectedStory) {
			throw new Error(`Story with id ${input.storyId} does not exist`);
		}

		try {
			const gameSession = roomService.getGameSession(input.roomId as RoomId);
			await gameSession?.startGame(selectedStory);

			return {
				success: true,
				message: `Story "${input.storyId}" started successfully`,
			};
		} catch (error) {
			console.error(`Failed to start story: %o`, error);
			throw new FailedToStartStoryError(
				input.storyId,
				(error as Error).message,
			);
		}
	});

export const getStories = publicProcedure.query(() => {
	return stories.map((s) => ({
		id: s.id,
		title: s.title,
		front: s.front,
	}));
});
