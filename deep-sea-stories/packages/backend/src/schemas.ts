import z from 'zod';

export const getRoomInputSchema = z.object({ roomId: z.string() });

export const createPeerInputSchema = z.object({
	roomId: z.string(),
	name: z.string(),
});

export const selectStoryInputSchema = z.object({
	roomId: z.string(),
	storyId: z.number(),
	userName: z.string(),
});

export const startStoryInputSchema = z.object({
	roomId: z.string(),
});

export const stopGameInputSchema = z.object({
	roomId: z.string(),
});
