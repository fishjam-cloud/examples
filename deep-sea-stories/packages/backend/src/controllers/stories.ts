import { publicProcedure } from '../trpc.js';
import { stories } from '../config.js';
import {
	selectStoryInputSchema,
	startStoryInputSchema,
	stopGameInputSchema,
} from '../schemas.js';
import type { RoomId } from '@fishjam-cloud/js-server-sdk';
import { roomService } from '../service/room.js';
import { FailedToStartStoryError } from '../domain/errors.js';
import { notifierService } from '../service/notifier.js';

export const selectStory = publicProcedure
	.input(selectStoryInputSchema)
	.mutation(async ({ input }) => {
		const selectedStory = stories.find((s) => s.id === input.storyId);
		if (!selectedStory) {
			throw new Error(`Story with id ${input.storyId} does not exist`);
		}

		try {
			const gameSession = roomService.getGameSession(input.roomId as RoomId);
			gameSession?.setStory(selectedStory);

			notifierService.emitNotification({
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
			const gameSession = roomService.getGameSession(input.roomId as RoomId);
			const story = gameSession?.getStory();

			if (!story) {
				throw new Error('No story selected. Please select a story first.');
			}

			await gameSession?.startGame(story);

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
			const gameSession = roomService.getGameSession(input.roomId as RoomId);
			await gameSession?.stopGame();

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
