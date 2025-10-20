import z from 'zod';

export const getRoomInputSchema = z.object({ roomId: z.string() });

export const createPeerInputSchema = z.object({ roomId: z.string() });

export const startStoryInputSchema = z.object({
	roomId: z.string(),
	storyId: z.number(),
});
