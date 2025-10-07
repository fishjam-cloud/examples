import { publicProcedure } from '../trpc.js';
import { stories } from '../config.js';
import { startStoryInputSchema } from '../schemas.js';
import { gameService } from '../service/game.js';
import type { RoomId } from '@fishjam-cloud/js-server-sdk';

export const startStory = publicProcedure
	.input(startStoryInputSchema)
	.mutation(async ({ input }) => {
		const selectedStory = stories.find((s) => s.title === input.storyTitle);
		if (!selectedStory) {
			throw new Error(`Story with title ${input.storyTitle} does not exist`);
		}

		try {
			await gameService.startGame(input.roomId as RoomId, selectedStory);

			return {
				success: true,
				message: `Story "${input.storyTitle}" started successfully`,
			};
		} catch (error) {
			console.error(`Failed to start story: ${error}`);
			throw new Error(
				`Failed to start story: ${error instanceof Error ? error.message : 'Unknown error'}`,
			);
		}
	});

export const getStories = publicProcedure.query(() => {
	return stories.map((s) => s.title);
});
