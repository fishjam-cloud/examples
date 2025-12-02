import type { RoomId } from '@fishjam-cloud/js-server-sdk';
import { stories } from '../config.js';
import { FailedToStartStoryError } from '../domain/errors.js';
import {
	selectStoryInputSchema,
	startStoryInputSchema,
	stopGameInputSchema,
} from '../schemas.js';
import { roomService } from '../service/room.js';
import { publicProcedure } from '../trpc.js';

export const selectStory = publicProcedure
	.input(selectStoryInputSchema)
	.mutation(async ({ input, ctx }) => {
		const selectedStory = stories.find((s) => s.id === input.storyId);
		if (!selectedStory) {
			throw new Error(`Story with id ${input.storyId} does not exist`);
		}

		try {
			roomService.getGameRoom(input.roomId as RoomId)?.setStory(selectedStory);

			ctx.notifierService.emitNotification(input.roomId as RoomId, {
				type: 'storySelected' as const,
				timestamp: Date.now(),
				storyId: selectedStory.id,
				storyTitle: selectedStory.title,
				userName: input.userName,
			});

			return {
				success: true,
				message: `Story "${selectedStory.title}" selected successfully`,
			};
		} catch (error) {
			console.error(`Failed to select story: %o`, error);
			throw new Error((error as Error).message);
		}
	});

export const startStory = publicProcedure
	.input(startStoryInputSchema)
	.mutation(async ({ input }) => {
		try {
			const gameRoom = roomService.getGameRoom(input.roomId as RoomId);
			const story = gameRoom?.getStory();

			if (!story) {
				throw new Error('No story selected. Please select a story first.');
			}

			await gameRoom?.startGame();

			return {
				success: true,
				message: `Story "${story.title}" started successfully`,
			};
		} catch (error) {
			console.error(`Failed to start story: %o`, error);
			throw new FailedToStartStoryError(0, (error as Error).message);
		}
	});

export const stopGame = publicProcedure
	.input(stopGameInputSchema)
	.mutation(async ({ input }) => {
		try {
			await roomService.getGameRoom(input.roomId as RoomId)?.stopGame();

			return {
				success: true,
				message: 'Game stopped successfully',
			};
		} catch (error) {
			console.error(`Failed to stop game: %o`, error);
			throw new Error((error as Error).message);
		}
	});

export const getStories = publicProcedure.query(() => {
	return stories.map((s) => ({
		id: s.id,
		title: s.title,
		front: s.front,
	}));
});
