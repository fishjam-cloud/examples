import { publicProcedure } from '../trpc.js';
import { stories } from '../config.js';
import { startStoryInputSchema } from '../schemas.js';
import { roomService } from '../service/room.js';
import type { RoomId } from '@fishjam-cloud/js-server-sdk';

export const startStory = publicProcedure
	.input(startStoryInputSchema)
	.mutation(async ({ input }) => {
		const selectedStory = stories.find((s) => s.title === input.storyTitle);
		if (!selectedStory) {
			throw new Error(`Story with title ${input.storyTitle} does not exist`);
		}
		roomService.setStory(input.roomId as RoomId, selectedStory);

		// Create AI agent sessions for all currently connected peers
		const connectedPeerIds = roomService.getConnectedPeers(
			input.roomId as RoomId,
		);
		const sessionManager = roomService.getSessionManager(
			input.roomId as RoomId,
		);

		if (sessionManager && connectedPeerIds.length > 0) {
			console.log(
				`Creating AI sessions for ${connectedPeerIds.length} connected peers in room ${input.roomId}`,
			);

			// Create sessions for all connected peers
			await Promise.all(
				connectedPeerIds.map(async (peerId) => {
					try {
						await sessionManager.createSession(peerId, input.roomId as RoomId);
						console.log(
							`Created AI session for peer ${peerId} in room ${input.roomId}`,
						);
					} catch (error) {
						console.error(
							`Failed to create session for peer ${peerId}:`,
							error,
						);
					}
				}),
			);
		}

		return {
			success: true,
			message: `Story "${input.storyTitle}" started successfully`,
			sessionsCreated: connectedPeerIds.length,
		};
	});

export const getStories = publicProcedure.query(() => {
	return stories.map((s) => s.title);
});
